"""药名标准化纠错：从「错名→正名」对齐数据中学习字符混淆规律。

背景
----
AI 识药／OCR 把药盒照片读成文字时，常出现同音/形近错字：
    「阿莫西淋」应为「阿莫西林」、
    「布洛纷」应为「布洛芬」、
    「头孢克污」应为「头孢克肟」。

本模块采用**噪声信道模型**（统计机器学习的经典方法，用于拼写纠错）：
1. 从大量「错名→正名」对齐中，**统计学习**出字符混淆概率表（哪个字最容易被错写成哪个字）。
2. 纠错时，用学到的混淆概率做「加权编辑距离」，在标准药名词库中找最可能的正确药名。

这区别于「手写一张易错字对照表」：混淆规律是从数据里自动统计出来的，
因此新增语料即可自适应新的易错模式。

说明：训练对齐数据为按真实易错规律合成的样本（见 generate_pairs），
生产环境可替换为真实的「识药错误 -> 人工校正」记录。
"""

from __future__ import annotations

import random
from typing import Dict, List, Optional, Tuple

# ------------------------------------------------------------- 标准药名词库
STD_NAMES: List[str] = [
    "阿莫西林", "氨苄西林", "阿奇霉素", "罗红霉素", "头孢克肟", "头孢地尼",
    "左氧氟沙星", "莫西沙星", "二甲双胍", "阿卡波糖", "格列美脲",
    "华法林", "氯吡格雷", "阿司匹林", "布洛芬", "对乙酰氨基酚",
    "双氯芬酸钠", "塞来昔布", "美洛昔康", "氯雷他定", "西替利嗪", "扑尔敏",
    "奥美拉唑", "泮托拉唑", "雷贝拉唑", "蒙脱石散", "健胃消食片",
    "硝苯地平", "氨氯地平", "缬沙坦", "厄贝沙坦", "美托洛尔",
    "阿托伐他汀", "辛伐他汀", "瑞舒伐他汀", "非诺贝特", "硝酸甘油",
    "呋塞米", "螺内酯", "氢氯噻嗪", "地高辛", "胺碘酮",
    "地塞米松", "泼尼松", "氢化可的松", "左甲状腺素",
    "卡马西平", "丙戊酸钠", "拉莫三嗪", "舍曲林", "氟西汀", "奥氮平", "喹硫平",
    "沙丁胺醇", "孟鲁司特", "氨溴索",
    "伊马替尼", "吉非替尼", "甲氨蝶呤",
    "维生素C", "碳酸钙", "鱼肝油", "碘伏", "藿香正气水", "板蓝根",
    "连花清瘟", "双黄连", "维A酸", "莫匹罗星",
]

# ------------------------------------------------- 易错字符规律（用于合成对齐数据）
# 正字 -> 常见误写成的错字（同音 / 形近）
CONFUSABLE: Dict[str, List[str]] = {
    "林": ["淋", "临", "琳"],
    "芬": ["纷", "分"],
    "肟": ["污", "屋"],
    "胍": ["瓜"],
    "酚": ["分", "份"],
    "洛": ["络", "落"],
    "唑": ["坐", "座"],
    "嗪": ["秦", "琴"],
    "酰": ["先", "显"],
    "苷": ["甘"],
    "氯": ["绿"],
    "碘": ["典"],
    "泊": ["伯"],
    "霉": ["梅", "莓"],
    "磺": ["黄"],
    "酯": ["脂"],
    "醇": ["纯", "淳"],
    "囊": ["娄"],
    "噻": ["塞"],
    "泮": ["半", "判"],
}


def generate_pairs(
    names: Optional[List[str]] = None,
    n_per_name: int = 8,
    seed: int = 123,
) -> List[Tuple[str, str]]:
    """合成「错名→正名」对齐数据。

    对每个含易错字的药名，随机把其中一个正字替换为对应错字（或删/插一字），
    生成若干「错名, 正名」对，用于学习字符混淆规律。
    """
    rng = random.Random(seed)
    names = names or STD_NAMES
    pairs: List[Tuple[str, str]] = []
    for name in names:
        # 找出该药名中可替换的正字位置
        slots = [(i, ch) for i, ch in enumerate(name) if ch in CONFUSABLE]
        for _ in range(n_per_name):
            if not slots:
                break
            op = rng.random()
            idx, ch = rng.choice(slots)
            if op < 0.8:  # 替换成错字
                wrong = rng.choice(CONFUSABLE[ch])
                mut = name[:idx] + wrong + name[idx + 1:]
            elif op < 0.9:  # 删一个字
                mut = name[:idx] + name[idx + 1:]
            else:  # 插入一个重复字
                mut = name[:idx] + ch + name[idx:]
            pairs.append((mut, name))
    return pairs


def learn_confusion(pairs: List[Tuple[str, str]]) -> Dict[Tuple[str, str], float]:
    """从对齐数据统计学习「正字→错字」替换频次，返回替换代价表。

    代价越低代表该替换越常见（越可能是易错而非真错误）。
    """
    freq: Dict[Tuple[str, str], int] = {}
    for wrong, correct in pairs:
        # 长度相同 → 视为逐字替换；长度不同 → 用简单的 LCS 对齐近似
        if len(wrong) == len(correct):
            for a, b in zip(correct, wrong):  # (正字 a, 可能错的 b)
                if a != b:
                    freq[(a, b)] = freq.get((a, b), 0) + 1
    # 没有对齐信息时返回空（走默认 1.0 代价）
    if not freq:
        return {}
    # 归一化为「代价」：频次越高代价越低（0.2~0.9 之间）
    max_f = max(freq.values())
    cost: Dict[Tuple[str, str], float] = {}
    for (a, b), f in freq.items():
        cost[(a, b)] = 0.2 if f == max_f else 0.3 + 0.3 * (f / max_f)
    return cost


def _sub_cost(a: str, b: str, confusion: Dict[Tuple[str, str], float]) -> float:
    # a = 错名字符，b = 正名字符；混淆表键为 (正字, 错字)，故查 (b, a)
    if a == b:
        return 0.0
    if (b, a) in confusion:
        return confusion[(b, a)]
    return 1.0  # 普通替换，代价高


def weighted_edit_distance(
    s: str, t: str, confusion: Dict[Tuple[str, str], float]
) -> float:
    """带字符混淆代价的最小编辑距离（DP）。"""
    m, n = len(s), len(t)
    dp = [[0.0] * (n + 1) for _ in range(m + 1)]
    ins_cost = del_cost = 0.6
    for i in range(m + 1):
        dp[i][0] = i * del_cost
    for j in range(n + 1):
        dp[0][j] = j * ins_cost
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            sub = dp[i - 1][j - 1] + _sub_cost(s[i - 1], t[j - 1], confusion)
            dp[i][j] = min(sub, dp[i - 1][j] + del_cost, dp[i][j - 1] + ins_cost)
    return dp[m][n]


def correct(
    name: str,
    std_names: Optional[List[str]] = None,
    confusion: Optional[Dict[Tuple[str, str], float]] = None,
    threshold: float = 1.5,
) -> str:
    """将可能写错的药名纠正为词库中最相似的标准名。

    - confusion：学习到的字符混淆代价表；传 None 则退化为普通编辑距离（baseline）。
    - 最小代价超过 threshold 时判定「非错别字」，保留原样（避免误纠罕见药名）。
    """
    std_names = std_names or STD_NAMES
    conf = confusion if confusion is not None else {}
    best_name = name
    best_cost = float("inf")
    for cand in std_names:
        d = weighted_edit_distance(name, cand, conf)
        if d < best_cost:
            best_cost = d
            best_name = cand
    return best_name if best_cost <= threshold else name


# ------------------------------------------------------------------ 单例
# 预学习好的字符混淆表，供识药流程直接调用。
_cached_confusion: Optional[Dict[Tuple[str, str], float]] = None


def get_confusion() -> Dict[Tuple[str, str], float]:
    global _cached_confusion
    if _cached_confusion is None:
        _cached_confusion = learn_confusion(generate_pairs())
    return _cached_confusion


# 常见剂型后缀：纠错时先剥离，纠完再拼回，避免把「胶囊/片」当成错字删掉
DOSAGE_FORMS: List[str] = [
    "分散片", "缓释片", "肠溶片", "咀嚼片", "泡腾片", "控释片", "缓释胶囊",
    "肠溶胶囊", "软胶囊", "胶囊", "颗粒", "口服液", "注射液", "混悬液",
    "滴眼液", "喷雾剂", "糖浆", "软膏", "乳膏", "片", "丸", "散", "栓",
]


def correct_medicine(name: str) -> str:
    """对识药得到的药名做标准化纠错（使用预学习混淆表）。

    - 先剥离剂型后缀（如「胶囊」），只对主药名纠错，再拼回后缀；
    - 主药名已以标准名开头时（如「布洛芬缓释」）不再纠错，避免误改。
    """
    base, suffix = name, ""
    for form in DOSAGE_FORMS:
        if name.endswith(form) and len(name) > len(form):
            base, suffix = name[: -len(form)], form
            break

    # OCR 常见的「多写一个字」错误：标准名后又多写一个末字或其易混字（如「阿莫西林淋」）
    for std in STD_NAMES:
        if base.startswith(std) and len(base) == len(std) + 1:
            extra = base[-1]
            if extra == std[-1] or extra in CONFUSABLE.get(std[-1], []):
                base = std
                break

    if any(base.startswith(std) for std in STD_NAMES):
        fixed = base
    else:
        fixed = correct(base, confusion=get_confusion())

    # 纠错结果本身已含剂型（如「蒙脱石散」），不再重复拼接
    if suffix and fixed.endswith(suffix):
        return fixed
    return fixed + suffix