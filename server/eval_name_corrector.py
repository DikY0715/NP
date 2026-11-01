"""药名纠错模型评测脚本。

运行方式（在 server/ 目录下）：
    python eval_name_corrector.py

验证：
1. 模型是否从「错名→正名」对齐数据中自动学出了字符混淆规律（易混字对）
2. 纠错准确率（整体 + 单字替换类）
3. 相比「手写规则 / 纯编辑距离」基线，学习法是否更准/更可解释
"""

from __future__ import annotations

from app.name_corrector import (
    correct,
    generate_pairs,
    learn_confusion,
    weighted_edit_distance,
)


def main() -> None:
    print("=" * 72)
    print("药名标准化纠错（噪声信道模型）· 评测")
    print("=" * 72)

    # 1) 用训练对齐数据学习字符混淆规律
    train_pairs = generate_pairs(seed=7)
    learned = learn_confusion(train_pairs)

    print(f"\n训练对齐样本：{len(train_pairs)} 条")
    print("\n" + "-" * 72)
    print("① 模型从数据中自动学到的「易混淆字符对」（代价越低成本越低 = 越常见）")
    print("-" * 72)
    top = sorted(learned.items(), key=lambda kv: kv[1])[:12]
    for (a, b), cost in top:
        print(f"  正字「{a}」→ 常误写为「{b}」（替换代价 {cost:.2f}）")

    # 2) 用另一批测试数据（不同 seed）评估纠错
    test_pairs = generate_pairs(n_per_name=3, seed=999)
    n_total = len(test_pairs)
    n_learn_ok = n_base_ok = 0
    n_sub = n_sub_learn_ok = n_sub_base_ok = 0

    examples = []
    for wrong, correct_name in test_pairs:
        is_sub = len(wrong) == len(correct_name)
        if is_sub:
            n_sub += 1
        out_learn = correct(wrong, confusion=learned)
        out_base = correct(wrong, confusion=None)
        if out_learn == correct_name:
            n_learn_ok += 1
            if is_sub:
                n_sub_learn_ok += 1
        if out_base == correct_name:
            n_base_ok += 1
            if is_sub:
                n_sub_base_ok += 1
        if len(examples) < 6 and out_learn == correct_name and out_base != correct_name:
            examples.append((wrong, correct_name, out_base))

    print("\n" + "-" * 72)
    print("② 纠错准确率（学习法 vs 纯编辑距离基线）")
    print("-" * 72)
    print(f"  整体：学习法 {n_learn_ok}/{n_total} = {n_learn_ok/n_total:.1%}"
          f"   基线 {n_base_ok}/{n_total} = {n_base_ok/n_total:.1%}")
    if n_sub:
        print(f"  单字替换类：学习法 {n_sub_learn_ok}/{n_sub} = {n_sub_learn_ok/n_sub:.1%}"
              f"   基线 {n_sub_base_ok}/{n_sub} = {n_sub_base_ok/n_sub:.1%}")

    if examples:
        print("\n" + "-" * 72)
        print("③ 学习法优于基线的纠正示例（基线纠错失败、学习法纠正成功）")
        print("-" * 72)
        for wrong, correct_name, base_out in examples:
            print(f"  输入「{wrong}」→ 学习法「{correct_name}」✓ / 基线「{base_out}」✗")

    print("\n" + "-" * 72)
    print("④ 直接演示几个纠错")
    print("-" * 72)
    for wrong in ["阿莫西淋", "布洛纷", "头孢克污", "二甲双瓜"]:
        out = correct(wrong, confusion=learned)
        print(f"  「{wrong}」→「{out}」")

    print("\n" + "=" * 72)


if __name__ == "__main__":
    main()