"""用药安全评估引擎自测 / 评测脚本。

运行方式（在 server/ 目录下）：
    python eval_safety.py

对一组构造的「借药场景」跑评估引擎，逐例比对期望的风险等级与命中的风险类别，
输出通过率与逐例明细，用于验证规则库的召回与分级是否合理。

注意：本脚本不依赖数据库，直接调用 safety_engine 的纯函数核心。
"""

from __future__ import annotations

from datetime import datetime

from app.safety_engine import evaluate_medication_safety

_YEAR = datetime.now().year

# 每个用例：(标题, 输入 kw, 期望风险等级, 期望命中的风险类别)
CASES = [
    (
        "青霉素过敏者借阿莫西林 → 过敏拦截",
        dict(medicine_name="阿莫西林胶囊", is_otc=True, allergies=["青霉素过敏"]),
        "critical",
        ["过敏"],
    ),
    (
        "高血压患者借含麻黄碱复方感冒药 → 慢病禁忌",
        dict(medicine_name="复方感冒颗粒", is_otc=True, chronic_diseases=["高血压"]),
        "high",
        ["慢病禁忌"],
    ),
    (
        "胃溃疡患者借布洛芬 → 慢病禁忌",
        dict(medicine_name="布洛芬缓释胶囊", is_otc=True, chronic_diseases=["胃溃疡"]),
        "high",
        ["慢病禁忌"],
    ),
    (
        "正在服用华法林者借布洛芬 → 相互作用",
        dict(medicine_name="布洛芬缓释胶囊", is_otc=True, current_meds=["华法林钠片"]),
        "high",
        ["相互作用"],
    ),
    (
        "70 岁老人借苯海拉明 → 特殊人群",
        dict(medicine_name="盐酸苯海拉明片", is_otc=True, birth_year=_YEAR - 70),
        "medium",
        ["特殊人群"],
    ),
    (
        "处方药（is_otc=False）→ 硬拦截",
        dict(medicine_name="阿莫西林胶囊", is_otc=False),
        "critical",
        ["处方药"],
    ),
    (
        "8 岁儿童借阿司匹林 → 特殊人群（瑞氏综合征）",
        dict(medicine_name="阿司匹林肠溶片", is_otc=False, birth_year=_YEAR - 8),
        "critical",
        ["处方药", "特殊人群"],
    ),
    (
        "哮喘患者借阿司匹林 → 慢病禁忌",
        dict(medicine_name="阿司匹林肠溶片", is_otc=True, chronic_diseases=["哮喘"]),
        "high",
        ["慢病禁忌"],
    ),
    (
        "孕哺期备注 + 任意 OTC → 特殊人群",
        dict(medicine_name="对乙酰氨基酚片", is_otc=True, note="怀孕 12 周"),
        "high",
        ["特殊人群"],
    ),
    (
        "健康居民借普通 OTC → 低风险无命中",
        dict(medicine_name="对乙酰氨基酚片", is_otc=True),
        "low",
        [],
    ),
]


def main() -> None:
    passed = 0
    total = len(CASES)
    print("=" * 72)
    print("用药安全评估引擎 · 自测结果")
    print("=" * 72)

    for i, (title, kwargs, exp_level, exp_cats) in enumerate(CASES, 1):
        report = evaluate_medication_safety(**kwargs)
        cats = {f.category for f in report.findings}
        level_ok = report.risk_level == exp_level
        cat_ok = all(c in cats for c in exp_cats)
        ok = level_ok and cat_ok
        passed += int(ok)

        mark = "PASS" if ok else "FAIL"
        print(f"\n[{mark}] 用例 {i}: {title}")
        print(f"  期望等级={exp_level} 实际等级={report.risk_level}  "
              f"风险分={report.risk_score} 建议={report.recommendation}")
        if not level_ok:
            print(f"  ✗ 等级不符：期望 {exp_level}，得到 {report.risk_level}")
        if not cat_ok:
            missing = [c for c in exp_cats if c not in cats]
            print(f"  ✗ 缺少命中类别：{missing}（实际命中：{sorted(cats) or '无'}）")
        for f in report.findings:
            print(f"     · [{f.category}/{f.severity}] {f.message}")

    print("\n" + "=" * 72)
    print(f"通过 {passed}/{total}，准确率 {passed / total:.0%}")
    print("=" * 72)


if __name__ == "__main__":
    main()