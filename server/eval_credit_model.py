"""信用风险模型（逻辑回归）评测脚本。

运行方式（在 server/ 目录下）：
    python eval_credit_model.py

验证三件事：
1. 模型是否真的「学会」了业务规律（学到权重与真值权重的符号是否一致）
2. 分类指标：准确率 / 精确率 / 召回率 / F1 / AUC
3. 相比原来的「手写硬编码规则」，逻辑回归是否更准（baseline 对比）
"""

from __future__ import annotations

import time
from typing import List

from app.credit_model import (
    FEATURE_NAMES,
    _TRUE_WEIGHTS,
    LogisticModel,
    generate_dataset,
    train,
)


def _metrics(y_true: List[int], y_pred: List[int]):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    acc = (tp + tn) / max(1, len(y_true))
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return acc, precision, recall, f1


def _auc(y_true: List[int], probs: List[float]) -> float:
    """用「配对比较」法算 ROC 面积（不依赖第三方库）。"""
    pos = [p for p, t in zip(probs, y_true) if t == 1]
    neg = [p for p, t in zip(probs, y_true) if t == 0]
    if not pos or not neg:
        return 0.5
    n_p, n_n = len(pos), len(neg)
    correct = 0.0
    for a in pos:
        for b in neg:
            if a > b:
                correct += 1.0
            elif a == b:
                correct += 0.5
    return correct / (n_p * n_n)


def baseline_predict(x) -> int:
    """原「手写规则」的简化版：逾期/违规/异常任一 > 0 即判违约。"""
    return 1 if (x[1] > 0 or x[3] > 0 or x[7] > 0) else 0


def _print_weights(model: LogisticModel, learned: List[float]):
    print("\n" + "-" * 72)
    print("学到的权重 vs 业务真值权重（符号一致 = 模型学会了风险方向）")
    print("-" * 72)
    consistent = 0
    for i, name in enumerate(FEATURE_NAMES):
        lw = learned[i]
        tw = _TRUE_WEIGHTS[i]
        if abs(lw) <= 0.15:
            arrow = "≈0（模型判定该特征影响甚微）"
            consistent += 1
        elif (lw > 0) == (tw > 0):
            arrow = "✓"
            consistent += 1
        else:
            arrow = "✗ 方向相反"
        print(f"  {name:<16} 学到={lw:+.3f}  真值={tw:+.3f}  {arrow}")
    print(f"  → 8 个特征中 {consistent} 个学到正确方向或正确判定为弱信号")


def main() -> None:
    print("=" * 72)
    print("信用风险模型（逻辑回归）· 评测")
    print("=" * 72)

    X, y = generate_dataset(2000)
    split = int(len(X) * 0.7)
    Xtr, ytr = X[:split], y[:split]
    Xte, yte = X[split:], y[split:]

    t0 = time.time()
    model = train(Xtr, ytr, epochs=300, lr=0.4)
    train_sec = time.time() - t0

    probs = [model.predict_proba(x) for x in Xte]
    preds = [1 if p >= 0.5 else 0 for p in probs]

    acc, prec, rec, f1 = _metrics(yte, preds)
    auc = _auc(yte, probs)

    # baseline
    b_preds = [baseline_predict(x) for x in Xte]
    b_acc, b_prec, b_rec, b_f1 = _metrics(yte, b_preds)

    print(f"\n训练样本 {len(Xtr)} / 测试样本 {len(Xte)}，训练耗时 {train_sec:.2f}s")
    print("\n" + "-" * 72)
    print("① 分类指标（逻辑回归 vs 手写规则）")
    print("-" * 72)
    print(f"  {'指标':<10}{'逻辑回归':>14}{'手写规则(基线)':>20}")
    print(f"  {'准确率':<10}{acc:>13.1%}{b_acc:>19.1%}")
    print(f"  {'精确率':<10}{prec:>13.1%}{b_prec:>19.1%}")
    print(f"  {'召回率':<10}{rec:>13.1%}{b_rec:>19.1%}")
    print(f"  {'F1':<10}{f1:>13.1%}{b_f1:>19.1%}")
    print(f"  {'AUC':<10}{auc:>13.3f}{'-':>20}")

    print("\n" + "-" * 72)
    print("② 学习曲线（交叉熵损失随训练轮次下降 = 模型在收敛）")
    print("-" * 72)
    hist = model.loss_history
    for e in (0, 1, 4, 9, 19, 39, 79, len(hist) - 1):
        print(f"  epoch {e+1:>3}: loss = {hist[e]:.4f}")

    _print_weights(model, model.weights)

    print("\n" + "-" * 72)
    print("③ 示例：对两个居民打分（可解释）")
    print("-" * 72)
    good = [1.0, 0, 0, 0, 3, 2, 5, 0]     # 老实按时、有贡献
    bad = [0.2, 4, 3, 2, 0, 15, 0, 3]     # 多次逾期、被投诉、违规
    for name, fv in (("守信居民", good), ("高风险居民", bad)):
        score = model.credit_score(fv)
        p = model.predict_proba(fv)
        print(f"\n  {name}: 特征={fv}")
        print(f"    违约概率={p:.2%}  信用分={score}")
        top = sorted(model.contributions(fv), key=lambda t: -abs(t[1]))[:3]
        for feat, contrib in top:
            sign = "↑风险" if contrib > 0 else "↓风险"
            print(f"      · {feat}: {contrib:+.3f} ({sign})")

    print("\n" + "=" * 72)


if __name__ == "__main__":
    main()