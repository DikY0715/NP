"""药品分类器（处方药 / 品类）自测 / 评测脚本。

运行方式（在 server/ 目录下）：
    python eval_drug_classifier.py

对一组标注了「真实处方状态 + 品类」的常用药品名跑分类器，分别统计：
- 处方药 / 非处方药(OTC) 判定准确率
- 药品品类分类准确率
并逐例输出明细，暴露漏判 / 误分类样本。
"""

from __future__ import annotations

from app.drug_classifier import classify

# (药品名, 期望是否 OTC, 期望品类)
CASES = [
    # ---- 解热镇痛 ----
    ("布洛芬缓释胶囊", True, "解热镇痛药"),
    ("对乙酰氨基酚片", True, "解热镇痛药"),
    ("塞来昔布胶囊", False, "解热镇痛药"),
    ("美洛昔康片", False, "解热镇痛药"),
    # ---- 感冒 / 止咳化痰 ----
    ("复方氨酚烷胺片", True, "感冒药"),
    ("感冒灵颗粒", True, "感冒药"),
    ("川贝枇杷膏", True, "止咳化痰药"),
    ("氨溴索口服液", True, "止咳化痰药"),
    # ---- 抗菌 ----
    ("阿莫西林胶囊", False, "抗菌药"),
    ("头孢克肟分散片", False, "抗菌药"),
    ("左氧氟沙星片", False, "抗菌药"),
    ("阿奇霉素片", False, "抗菌药"),
    ("克拉霉素片", False, "抗菌药"),
    ("甲硝唑片", False, "抗菌药"),
    # ---- 抗病毒 ----
    ("奥司他韦胶囊", False, "抗病毒药"),
    ("阿昔洛韦片", False, "抗病毒药"),
    ("恩替卡韦片", False, "抗病毒药"),
    # ---- 抗真菌 ----
    ("氟康唑胶囊", False, "抗真菌药"),
    ("克霉唑软膏", True, "抗真菌药"),
    # ---- 抗过敏 ----
    ("氯雷他定片", True, "抗过敏药"),
    ("西替利嗪片", True, "抗过敏药"),
    # ---- 消化 ----
    ("奥美拉唑肠溶胶囊", False, "消化系统药"),
    ("蒙脱石散", True, "消化系统药"),
    ("健胃消食片", True, "消化系统药"),
    ("莫沙必利片", False, "消化系统药"),
    ("铝碳酸镁咀嚼片", True, "消化系统药"),
    # ---- 心血管 ----
    ("硝苯地平控释片", False, "心血管用药"),
    ("阿托伐他汀钙片", False, "心血管用药"),
    ("缬沙坦胶囊", False, "心血管用药"),
    ("美托洛尔缓释片", False, "心血管用药"),
    ("阿司匹林肠溶片", False, "心血管用药"),
    ("华法林钠片", False, "心血管用药"),
    ("氯吡格雷片", False, "心血管用药"),
    ("依那普利片", False, "心血管用药"),
    # ---- 降糖 ----
    ("二甲双胍片", False, "降糖药"),
    ("胰岛素注射液", False, "降糖药"),
    ("阿卡波糖片", False, "降糖药"),
    ("达格列净片", False, "降糖药"),
    # ---- 激素 ----
    ("地塞米松片", False, "糖皮质激素"),
    ("甲泼尼龙片", False, "糖皮质激素"),
    # ---- 镇静 ----
    ("地西泮片", False, "镇静安眠药"),
    ("艾司唑仑片", False, "镇静安眠药"),
    # ---- 精神类 ----
    ("舍曲林片", False, "精神类用药"),
    ("奥氮平片", False, "精神类用药"),
    ("卡马西平片", False, "精神类用药"),
    # ---- 呼吸 ----
    ("沙丁胺醇气雾剂", False, "呼吸系统药"),
    ("孟鲁司特钠片", False, "呼吸系统药"),
    # ---- 维生素与营养 ----
    ("维生素C片", True, "维生素与营养"),
    ("碳酸钙D3片", True, "维生素与营养"),
    ("鱼肝油", True, "维生素与营养"),
    # ---- 外用 ----
    ("碘伏消毒液", True, "外用药"),
    ("创可贴", True, "外用药"),
    ("云南白药气雾剂", True, "外用药"),
    # ---- 中成药 ----
    ("板蓝根颗粒", True, "中成药"),
    ("藿香正气水", True, "中成药"),
    ("连花清瘟胶囊", True, "中成药"),
    # ---- 眼科 ----
    ("玻璃酸钠滴眼液", True, "眼科用药"),
    ("拉坦前列素滴眼液", False, "眼科用药"),
    # ---- 皮肤 ----
    ("糠酸莫米松乳膏", False, "皮肤科用药"),
    ("莫匹罗星软膏", False, "皮肤科用药"),
    # ---- 泌尿男科 ----
    ("坦索罗辛缓释胶囊", False, "泌尿男科用药"),
    ("非那雄胺片", False, "泌尿男科用药"),
    # ---- 抗肿瘤 ----
    ("甲氨蝶呤片", False, "抗肿瘤药"),
    ("伊马替尼胶囊", False, "抗肿瘤药"),
]


def main() -> None:
    total = len(CASES)
    otc_ok = cat_ok = 0
    fails = 0

    print("=" * 72)
    print(f"药品分类器 · 自测结果（处方药判定 + 品类分类，共 {total} 例）")
    print("=" * 72)

    for i, (name, exp_otc, exp_cat) in enumerate(CASES, 1):
        d = classify(name)
        is_otc_hit = d.is_otc == exp_otc
        cat_hit = d.category == exp_cat
        otc_ok += int(is_otc_hit)
        cat_ok += int(cat_hit)
        if not (is_otc_hit and cat_hit):
            fails += 1

        mark = "PASS" if (is_otc_hit and cat_hit) else "FAIL"
        print(f"\n[{mark}] {i}. {name}")
        if not is_otc_hit:
            print(f"  OTC: 期望={'OTC' if exp_otc else '处方药'}  实际={d.label}  ✗"
                  + (f"（信号：{d.rx_signal}）" if d.rx_signal else ""))
        if not cat_hit:
            print(f"  品类: 期望={exp_cat}  实际={d.category}  ✗")

    print("\n" + "=" * 72)
    print(f"处方药判定准确率：{otc_ok}/{total} = {otc_ok / total:.0%}")
    print(f"品类分类准确率  ：{cat_ok}/{total} = {cat_ok / total:.0%}")
    print(f"综合准确率      ：{(otc_ok + cat_ok)}/{total * 2} = "
          f"{(otc_ok + cat_ok) / (total * 2):.0%}")
    if fails == 0:
        print("全部用例通过 ✓")
    print("=" * 72)


if __name__ == "__main__":
    from app.drug_classifier import RX_SIGNALS, CATEGORY_KB
    print(f"词库规模：处方药信号 {len(RX_SIGNALS)} 条；品类 {len(CATEGORY_KB)} 类、"
          f"关键词 {sum(len(k) for _, k in CATEGORY_KB)} 条\n")
    main()