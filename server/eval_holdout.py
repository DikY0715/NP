"""开放集评测：用「人工标注、与训练数据不同源」的测试集检验两个自研模型。

运行方式（在 server/ 目录下）：
    python eval_holdout.py

和 eval_credit_model.py / eval_name_corrector.py 的区别：
    那些脚本用「同一套合成规则」生成训练和测试数据（封闭集），准确率会偏高；
    本脚本的测试数据是人工编写的真实业务画像与真实 OCR 错例，
    并且包含训练时未出现的错误类型（形近字、漏字），更接近评委视角的真实泛化能力。
"""

from __future__ import annotations

import json
import os
from typing import Dict, List, Tuple

import app.name_corrector as nc
from app.credit_model import FEATURE_NAMES, generate_dataset, train
from app.name_corrector import correct_medicine

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "eval_data")


def _load(name: str) -> dict:
    with open(os.path.join(DATA_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def _metrics(y_true: List[int], y_pred: List[int]) -> Tuple[float, float, float, float]:
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    acc = (tp + tn) / max(1, len(y_true))
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return acc, precision, recall, f1


def _baseline_predict(x: List[float]) -> int:
    """原手写规则：被驳回 / 共享处方药 / 被扣分 任一 > 0 即判高风险。"""
    return 1 if (x[1] > 0 or x[3] > 0 or x[7] > 0) else 0


# ------------------------------------------------------------------ 信用模型
def eval_credit() -> None:
    print("=" * 74)
    print("① 信用风险模型 · 开放集评测（人工标注的真实业务画像）")
    print("=" * 74)

    data = _load("credit_test.json")["cases"]
    X_open = [c["features"] for c in data]
    y_open = [c["label"] for c in data]

    # 与生产一致：用合成数据全量训练
    X, y = generate_dataset(2000)
    model = train(X, y, epochs=300, lr=0.4)

    # 封闭集（同源）指标，用于对照
    split = int(len(X) * 0.7)
    Xtr, ytr, Xte, yte = X[:split], y[:split], X[split:], y[split:]
    closed = train(Xtr, ytr, epochs=300, lr=0.4)
    closed_preds = [1 if closed.predict_proba(x) >= 0.5 else 0 for x in Xte]
    closed_acc = _metrics(yte, closed_preds)[0]

    preds = [1 if model.predict_proba(x) >= 0.5 else 0 for x in X_open]
    acc, prec, rec, f1 = _metrics(y_open, preds)
    b_preds = [_baseline_predict(x) for x in X_open]
    b_acc, b_prec, b_rec, b_f1 = _metrics(y_open, b_preds)

    print(f"\n  开放集样本：{len(X_open)} 条（{sum(y_open)} 条高风险 / {len(y_open) - sum(y_open)} 条正常）")
    print("\n  " + "-" * 68)
    print(f"  {'指标':<8}{'逻辑回归(开放集)':>18}{'手写规则(开放集)':>20}")
    print("  " + "-" * 68)
    print(f"  {'准确率':<8}{acc:>17.1%}{b_acc:>19.1%}")
    print(f"  {'精确率':<8}{prec:>17.1%}{b_prec:>19.1%}")
    print(f"  {'召回率':<8}{rec:>17.1%}{b_rec:>19.1%}")
    print(f"  {'F1':<8}{f1:>17.1%}{b_f1:>19.1%}")
    print("  " + "-" * 68)
    print(f"  对照：同一模型在「封闭集(与训练同源)」的准确率 = {closed_acc:.1%}")
    print("  两者不可直接比较：封闭集标签由概率抽样生成，天然含约 1/4 的边界噪声样本；")
    print("  开放集是人工按业务常识标注的清晰画像。两组都报告，供交叉参考。")

    wrong = [
        (c, p) for c, p in zip(data, preds) if p != c["label"]
    ]
    if wrong:
        print("\n  判错的样本：")
        for c, p in wrong:
            prob = model.predict_proba(c["features"])
            print(f"    · {c['id']} 标注={'高风险' if c['label'] else '正常'}"
                  f" 模型={'高风险' if p else '正常'}({prob:.1%})  {c['note']}")
    else:
        print("\n  开放集全部判对。")


# ------------------------------------------------------------------ 纠错模型
def eval_correction() -> None:
    print("\n" + "=" * 74)
    print("② 药名纠错模型 · 开放集评测（人工编写的真实 OCR 错例）")
    print("=" * 74)

    data = _load("name_correction_test.json")
    cases = data["replace_cases"]
    keep = data["keep_cases"]

    # 完整模型（学习到的混淆表）
    hit = [(c, correct_medicine(c["wrong"]) == c["correct"]) for c in cases]

    # 对照：把混淆表清空 → 退化为普通编辑距离（其余逻辑不变）
    saved = nc.get_confusion()
    nc._cached_confusion = {}
    hit_plain = [(c, correct_medicine(c["wrong"]) == c["correct"]) for c in cases]
    keep_plain_ok = sum(1 for k in keep if correct_medicine(k["name"]) == k["name"])
    nc._cached_confusion = saved

    keep_ok = sum(1 for k in keep if correct_medicine(k["name"]) == k["name"])

    acc = sum(1 for _, ok in hit if ok) / max(1, len(cases))
    plain_acc = sum(1 for _, ok in hit_plain if ok) / max(1, len(cases))

    print(f"\n  纠错样本：{len(cases)} 条错例 + {len(keep)} 条「本应保持不变」的样本")
    print("\n  " + "-" * 68)
    print(f"  {'模型':<26}{'纠错准确率':>14}{'误纠率(改坏正确名)':>22}")
    print("  " + "-" * 68)
    print(f"  {'完整模型(学习混淆表)':<26}{acc:>14.1%}{(1 - keep_ok / max(1, len(keep))):>21.1%}")
    print(f"  {'对照(纯编辑距离, 无混淆表)':<26}{plain_acc:>14.1%}"
          f"{(1 - keep_plain_ok / max(1, len(keep))):>20.1%}")
    print("  " + "-" * 68)

    # 分类型统计
    by_type: Dict[str, List[bool]] = {}
    for c, ok in hit:
        by_type.setdefault(c["type"], []).append(ok)
    print("\n  按错误类型：")
    for t, oks in by_type.items():
        print(f"    · {t:<18} {sum(oks)}/{len(oks)} = {sum(oks) / len(oks):.0%}")

    fails = [c for c, ok in hit if not ok]
    if fails:
        print("\n  纠错失败的样本：")
        for c in fails:
            print(f"    · 「{c['wrong']}」应为「{c['correct']}」"
                  f" → 模型给出「{correct_medicine(c['wrong'])}」（{c['type']}）")
    else:
        print("\n  全部纠错正确。")

    bad_keep = [k for k in keep if correct_medicine(k["name"]) != k["name"]]
    if bad_keep:
        print("\n  被误改的正确药名：")
        for k in bad_keep:
            print(f"    · 「{k['name']}」→「{correct_medicine(k['name'])}」")


def main() -> None:
    eval_credit()
    eval_correction()
    print("\n" + "=" * 74)


if __name__ == "__main__":
    main()
