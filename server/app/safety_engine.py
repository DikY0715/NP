"""用药安全评估引擎（可解释规则引擎）。

在不依赖外部大模型的前提下，基于本地药品知识库与专家规则，对「居民借药」
这一行为做用药安全评估，输出可解释的风险评分、风险等级、命中的禁忌项与给医生
的处置建议。

设计要点
--------
1. 纯函数式核心 `evaluate_medication_safety`：输入已抽取的字段，输出结构化结果，
   不依赖数据库，便于离线评测与单元测试。
2. 知识库 + 通用规则解耦：新增药品 / 过敏 / 慢病条目只需追加一行，不改引擎逻辑。
3. 可解释：每个风险项都给出「类别 + 严重度 + 说明 + 建议」，评分由风险项加权累加，
   医生可从数字反推「为什么这个申请被标红」。

评分模型
--------
- 每个 finding 按严重度赋权：critical=40 / high=25 / medium=15 / low=5。
- risk_score = min(100, 各 finding 权重之和)，分数越高风险越大。
- risk_level = findings 中的最高严重度（无命中为 low）。
- recommendation 由风险等级决定：critical→reject，high/medium→review，low→approve。

风险维度
--------
- 处方药硬拦截：Rx 药品原则上不可在社区赠/转（业务层已拦截，评估再次提示）。
- 过敏禁忌：居民过敏原命中药品类别（含交叉过敏，如青霉素→头孢）。
- 慢病禁忌：高血压/溃疡/哮喘/糖尿病/青光眼/肝肾疾病等与药品类别冲突。
- 药物相互作用：居民正在服用的药品与新借药品类别叠加风险。
- 特殊人群：≥65 岁老人、≤12 岁儿童、孕哺期（从备注识别）。
- 对症性提示：申请症状与药品适应症不匹配时提醒医生核实（不参与拦截）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------- 严重度与权重
_SEVERITY_WEIGHT: Dict[str, int] = {
    "critical": 40,
    "high": 25,
    "medium": 15,
    "low": 5,
}
_SEVERITY_ORDER: Dict[str, int] = {"low": 1, "medium": 2, "high": 3, "critical": 4}

# ---------------------------------------------------------------- 药品知识库
# 每项：(药品关键词, 危险属性标签集合, 类别中文说明)
# 匹配方式：药品名包含关键词（不区分大小写）。
DRUG_KB: List[Tuple[str, frozenset, str]] = [
    # 抗菌药
    ("阿莫西林", frozenset({"penicillin"}), "抗菌药·青霉素类"),
    ("氨苄西林", frozenset({"penicillin"}), "抗菌药·青霉素类"),
    ("青霉素", frozenset({"penicillin"}), "抗菌药·青霉素类"),
    ("头孢", frozenset({"cephalosporin"}), "抗菌药·头孢类"),
    ("磺胺", frozenset({"sulfa"}), "抗菌药·磺胺类"),
    ("庆大霉素", frozenset({"ototoxic", "nephrotoxic"}), "抗菌药·氨基糖苷类"),
    ("阿米卡星", frozenset({"ototoxic", "nephrotoxic"}), "抗菌药·氨基糖苷类"),
    # 解热镇痛 / 非甾体抗炎药 (NSAID)
    ("布洛芬", frozenset({"nsaid"}), "解热镇痛·NSAID"),
    ("双氯芬酸", frozenset({"nsaid"}), "解热镇痛·NSAID"),
    ("萘普生", frozenset({"nsaid"}), "解热镇痛·NSAID"),
    ("吲哚美辛", frozenset({"nsaid"}), "解热镇痛·NSAID"),
    ("塞来昔布", frozenset({"nsaid"}), "解热镇痛·NSAID"),
    ("阿司匹林", frozenset({"nsaid", "salicylate"}), "解热镇痛·水杨酸"),
    ("对乙酰氨基酚", frozenset({"hepatotoxic"}), "解热镇痛·乙酰苯胺"),
    ("扑热息痛", frozenset({"hepatotoxic"}), "解热镇痛·乙酰苯胺"),
    # 抗凝
    ("华法林", frozenset({"anticoagulant"}), "抗凝药"),
    ("氯吡格雷", frozenset({"antiplatelet"}), "抗血小板药"),
    ("利伐沙班", frozenset({"anticoagulant"}), "抗凝药"),
    # 糖皮质激素
    ("地塞米松", frozenset({"glucocorticoid"}), "糖皮质激素"),
    ("泼尼松", frozenset({"glucocorticoid"}), "糖皮质激素"),
    ("氢化可的松", frozenset({"glucocorticoid"}), "糖皮质激素"),
    # 感冒药（含拟交感 / 抗组胺成分）
    ("麻黄碱", frozenset({"ephedrine"}), "感冒药·拟交感"),
    ("伪麻黄碱", frozenset({"ephedrine"}), "感冒药·拟交感"),
    ("氯苯那敏", frozenset({"anticholinergic"}), "抗组胺·第一代"),
    ("扑尔敏", frozenset({"anticholinergic"}), "抗组胺·第一代"),
    ("苯海拉明", frozenset({"anticholinergic"}), "抗组胺·第一代"),
    # 心血管
    ("美托洛尔", frozenset({"beta_blocker"}), "β受体阻滞剂"),
    ("普萘洛尔", frozenset({"beta_blocker"}), "β受体阻滞剂"),
    ("硝苯地平", frozenset({"antihypertensive"}), "降压药"),
    ("氨氯地平", frozenset({"antihypertensive"}), "降压药"),
    ("卡托普利", frozenset({"antihypertensive"}), "降压药"),
    ("缬沙坦", frozenset({"antihypertensive"}), "降压药"),
    # 降糖
    ("二甲双胍", frozenset({"antidiabetic"}), "降糖药"),
    ("格列本脲", frozenset({"antidiabetic"}), "降糖药"),
    ("胰岛素", frozenset({"antidiabetic"}), "降糖药"),
    # 镇静安眠
    ("地西泮", frozenset({"sedative"}), "镇静安眠药"),
    ("艾司唑仑", frozenset({"sedative"}), "镇静安眠药"),
    ("阿普唑仑", frozenset({"sedative"}), "镇静安眠药"),
    # 其他
    ("甘草", frozenset({"pseudoaldosteronism"}), "中成药·含甘草（可致水钠潴留/血压升高）"),
    ("复方感冒", frozenset({"ephedrine", "anticholinergic"}), "复方感冒药（多含拟交感/抗组胺）"),
    ("糖浆", frozenset({"contains_sugar"}), "含糖口服制剂"),
]

# ---------------------------------------------------------------- 过敏禁忌
# 每项：(过敏原关键词, 命中即禁用的药品标签集合, 说明)
ALLERGY_KB: List[Tuple[str, frozenset, str]] = [
    ("青霉素", frozenset({"penicillin", "cephalosporin"}), "青霉素类过敏（与头孢存在交叉过敏）"),
    ("头孢", frozenset({"cephalosporin"}), "头孢类过敏"),
    ("磺胺", frozenset({"sulfa"}), "磺胺类过敏"),
    ("阿司匹林", frozenset({"salicylate", "nsaid"}), "阿司匹林/水杨酸类过敏"),
    ("布洛芬", frozenset({"nsaid"}), "NSAID 过敏"),
]

# ---------------------------------------------------------------- 慢病禁忌
# 每项：(慢病关键词, 命中即禁用的药品标签集合, 说明)
CHRONIC_KB: List[Tuple[str, frozenset, str]] = [
    ("高血压", frozenset({"ephedrine", "glucocorticoid", "pseudoaldosteronism"}),
     "高血压患者慎用含麻黄碱、激素或含甘草类药物，可能升高血压"),
    ("胃溃疡", frozenset({"nsaid", "salicylate"}), "胃/十二指肠溃疡禁用 NSAID，可诱发消化道出血"),
    ("消化性溃疡", frozenset({"nsaid", "salicylate"}), "消化性溃疡禁用 NSAID"),
    ("胃出血", frozenset({"nsaid", "salicylate"}), "消化道出血史禁用 NSAID"),
    ("哮喘", frozenset({"salicylate", "beta_blocker"}), "哮喘患者禁用阿司匹林及 β 受体阻滞剂"),
    ("糖尿病", frozenset({"contains_sugar", "glucocorticoid"}), "糖尿病患者慎用含糖制剂与糖皮质激素"),
    ("青光眼", frozenset({"anticholinergic", "ephedrine"}), "青光眼患者禁用抗胆碱、拟交感药"),
    ("前列腺增生", frozenset({"anticholinergic", "ephedrine"}), "前列腺增生慎用抗胆碱、拟交感药"),
    ("肾功能不全", frozenset({"nsaid", "nephrotoxic", "ototoxic"}), "肾功能不全慎用 NSAID 及肾/耳毒性药物"),
    ("肾病", frozenset({"nsaid", "nephrotoxic", "ototoxic"}), "肾病慎用 NSAID 及肾/耳毒性药物"),
    ("肝功能不全", frozenset({"hepatotoxic", "nsaid"}), "肝功能不全慎用对乙酰氨基酚及 NSAID"),
    ("肝病", frozenset({"hepatotoxic", "nsaid"}), "肝病慎用肝毒性药物"),
    ("冠心病", frozenset({"nsaid", "ephedrine"}), "冠心病慎用 NSAID 及拟交感药"),
    ("心脏病", frozenset({"nsaid", "ephedrine"}), "心脏病慎用 NSAID 及拟交感药"),
    ("心律失常", frozenset({"ephedrine"}), "心律失常慎用拟交感药"),
    ("甲亢", frozenset({"ephedrine"}), "甲亢慎用拟交感药"),
]

# ---------------------------------------------------------------- 药物相互作用
# 每项：(已有用药标签集合, 新药标签集合, 说明, 严重度)
# 说明：居民「正在服用」的药品类别与新借药品类别叠加时触发。
INTERACTION_KB: List[Tuple[frozenset, frozenset, str, str]] = [
    (frozenset({"anticoagulant"}), frozenset({"nsaid", "salicylate", "antiplatelet"}),
     "抗凝药与 NSAID/抗血小板药联用，出血风险显著升高", "high"),
    (frozenset({"nsaid", "salicylate"}), frozenset({"nsaid", "salicylate"}),
     "两种 NSAID 联用，消化道出血与肾损伤风险升高", "high"),
    (frozenset({"antihypertensive"}), frozenset({"ephedrine"}),
     "降压药与含麻黄碱药联用，可能拮抗降压作用、升高血压", "medium"),
    (frozenset({"antidiabetic"}), frozenset({"contains_sugar", "glucocorticoid"}),
     "降糖药与含糖/激素制剂联用，血糖波动风险升高", "medium"),
    (frozenset({"sedative"}), frozenset({"sedative"}),
     "多种镇静安眠药联用，呼吸抑制与过度镇静风险升高", "high"),
    (frozenset({"antihypertensive", "antidiabetic"}), frozenset({"glucocorticoid"}),
     "激素可升高血压、血糖，与降压/降糖药联用需监测", "medium"),
]

# ---------------------------------------------------------------- 特殊人群
_SENIOR_AGE = 65  # 老年阈值（岁）
_CHILD_AGE = 12   # 儿童阈值（岁）

# 孕妇/哺乳关键词（从备注文本识别，低置信度，仅提示）
_PREGNANCY_KEYS = ["孕", "怀孕", "妊娠", "哺乳", "备孕", "孕期"]

SENIOR_CAUTION_TAGS = frozenset({"anticholinergic", "sedative", "nsaid"})
CHILD_FORBIDDEN_TAGS = frozenset({"salicylate"})

# ---------------------------------------------------------------- 对症性提示（低置信度，不拦截）
_SYMPTOM_WORDS = [
    "发热", "发烧", "头痛", "头晕", "咳嗽", "感冒", "鼻塞", "流涕", "咽痛", "喉咙",
    "胃痛", "胃疼", "腹泻", "便秘", "失眠", "过敏", "瘙痒", "皮疹", "关节", "疼痛",
    "牙痛", "痛经", "胸闷", "哮喘", "高血压", "糖尿病", "炎症", "感染", "烫伤", "外伤",
    "皮肤", "恶心", "呕吐", "腰酸", "背痛", "眩晕", "流鼻血", "眼", "耳", "鼻",
]


@dataclass
class SafetyFinding:
    category: str      # 处方药 / 过敏 / 慢病禁忌 / 相互作用 / 特殊人群 / 对症性
    severity: str      # critical / high / medium / low
    message: str
    suggestion: str = ""


@dataclass
class SafetyReport:
    risk_score: int = 0
    risk_level: str = "low"
    recommendation: str = "approve"
    summary: str = ""
    findings: List[SafetyFinding] = field(default_factory=list)


# ---------------------------------------------------------------- 工具函数
def _match_drug_tags(name: str) -> Tuple[frozenset, str]:
    """根据药品名命中药品类别标签，返回 (标签集合, 类别说明)。"""
    tags: set = set()
    categories: List[str] = []
    lowered = (name or "").lower()
    for kw, t, cat in DRUG_KB:
        if kw.lower() in lowered:
            tags |= t
            if cat not in categories:
                categories.append(cat)
    return frozenset(tags), "、".join(categories) if categories else "未收录类别"


def _extract_symptom_words(text: str) -> set:
    return {w for w in _SYMPTOM_WORDS if w in (text or "")}


def _current_age(birth_year: Optional[int]) -> Optional[int]:
    if not birth_year:
        return None
    return datetime.now().year - birth_year


# ---------------------------------------------------------------- 核心评估
def evaluate_medication_safety(
    medicine_name: str,
    medicine_symptoms: Optional[List[str]] = None,
    is_otc: bool = True,
    allergies: Optional[List[str]] = None,
    chronic_diseases: Optional[List[str]] = None,
    birth_year: Optional[int] = None,
    note: str = "",
    current_meds: Optional[List[str]] = None,
) -> SafetyReport:
    """评估一次借药的用药安全风险，返回可解释的结构化报告。

    参数语义：
    - medicine_name / medicine_symptoms / is_otc：被借药品信息与适应症。
    - allergies / chronic_diseases / birth_year / note：借药人的健康档案。
    - current_meds：借药人正在服用的药品名称列表（用于相互作用）。
    """
    name = (medicine_name or "").strip()
    med_symptoms = medicine_symptoms or []
    tag_set, category = _match_drug_tags(name)
    findings: List[SafetyFinding] = []

    # 1) 处方药硬拦截
    if not is_otc:
        findings.append(SafetyFinding(
            category="处方药",
            severity="critical",
            message=f"{name} 为处方药，按社区安全规则不可赠予/转让",
            suggestion="建议驳回该申请，并告知居民须凭医生处方就诊",
        ))

    # 2) 过敏禁忌
    for kw, forbidden, desc in ALLERGY_KB:
        if any(kw in (a or "") for a in (allergies or [])):
            if tag_set & forbidden:
                findings.append(SafetyFinding(
                    category="过敏",
                    severity="critical",
                    message=f"居民存在「{kw}」过敏史，{name}（{category}）可能诱发过敏",
                    suggestion=f"{desc}，建议驳回并核实过敏史",
                ))

    # 3) 慢病禁忌
    for kw, forbidden, desc in CHRONIC_KB:
        if any(kw in (c or "") for c in (chronic_diseases or [])):
            if tag_set & forbidden:
                findings.append(SafetyFinding(
                    category="慢病禁忌",
                    severity="high",
                    message=f"居民患「{kw}」，服用 {name}（{category}）存在禁忌",
                    suggestion=desc,
                ))

    # 4) 药物相互作用
    current_tags: set = set()
    current_names: List[str] = []
    for m in (current_meds or []):
        mtags, _ = _match_drug_tags(m)
        if mtags:
            current_tags |= mtags
            if m not in current_names:
                current_names.append(m)
    if current_tags:
        for have, new, desc, sev in INTERACTION_KB:
            if (current_tags & have) and (tag_set & new):
                findings.append(SafetyFinding(
                    category="相互作用",
                    severity=sev,
                    message=f"居民正在服用 {('、'.join(current_names))}，与新借的 {name}（{category}）存在相互作用",
                    suggestion=desc,
                ))

    # 5) 特殊人群
    age = _current_age(birth_year)
    if age is not None and age >= _SENIOR_AGE:
        if tag_set & SENIOR_CAUTION_TAGS:
            findings.append(SafetyFinding(
                category="特殊人群",
                severity="medium",
                message=f"居民为 {age} 岁老年人，服用 {name}（{category}）需谨慎",
                suggestion="高龄人群慎用抗胆碱、镇静及 NSAID，注意跌倒与胃黏膜保护",
            ))
    if age is not None and 0 < age <= _CHILD_AGE:
        if tag_set & CHILD_FORBIDDEN_TAGS:
            findings.append(SafetyFinding(
                category="特殊人群",
                severity="critical",
                message=f"居民为 {age} 岁儿童，禁用 {name}（{category}）",
                suggestion="儿童使用水杨酸类可能诱发瑞氏综合征，建议驳回",
            ))
    if any(k in (note or "") for k in _PREGNANCY_KEYS):
        findings.append(SafetyFinding(
            category="特殊人群",
            severity="high",
            message=f"备注提示孕哺期，服用 {name} 需经医生评估",
            suggestion="孕哺期用药风险较高，建议驳回并引导至正规医疗机构",
        ))

    # 6) 对症性提示（低置信度，仅提醒）
    if note:
        note_syms = _extract_symptom_words(note)
        med_syms = set()
        for s in med_symptoms:
            med_syms |= _extract_symptom_words(s)
        if note_syms and not (note_syms & med_syms):
            findings.append(SafetyFinding(
                category="对症性",
                severity="low",
                message=f"申请症状（{('、'.join(sorted(note_syms)))})与药品适应症「{('、'.join(med_symptoms))}」匹配度较低",
                suggestion="请医生核实是否对症，必要时补充问诊",
            ))

    # ---------------------------------------------------------------- 汇总评分
    if not findings:
        return SafetyReport(
            risk_score=0,
            risk_level="low",
            recommendation="approve",
            summary=f"未发现 {name} 与居民健康档案的用药禁忌，可常规审核",
        )

    score = min(100, sum(_SEVERITY_WEIGHT[f.severity] for f in findings))
    level = max(findings, key=lambda f: _SEVERITY_ORDER[f.severity]).severity

    if level == "critical":
        recommendation = "reject"
    elif level in ("high", "medium"):
        recommendation = "review"
    else:
        recommendation = "approve"

    n_map = {s: sum(1 for f in findings if f.severity == s) for s in _SEVERITY_ORDER}
    summary_parts = [f"{k}：{n_map[k]} 条" for k in ("critical", "high", "medium", "low") if n_map[k]]
    summary = f"命中 {len(findings)} 条风险（{'，'.join(summary_parts)}），建议「{'驳回' if recommendation == 'reject' else ('复核' if recommendation == 'review' else '常规通过')}」"

    return SafetyReport(
        risk_score=score,
        risk_level=level,
        recommendation=recommendation,
        summary=summary,
        findings=findings,
    )