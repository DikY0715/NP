"""信用风险评分模型：逻辑回归。

为什么要有这个模型
--------------------
社区药品互助存在「失信风险」：借药逾期不还、私传处方药、被多次投诉、囤药倒卖等。
过去的做法是手写规则（按时还 +5、逾期 -20、低于 60 分拉黑），拍脑袋定权重。

本模块用**逻辑回归**让模型从历史行为特征中**自动学出每个行为的风险权重**：
- 输入：居民的 8 维行为特征（按时归还率、逾期次数、被投诉次数……）
- 输出：违约概率 → 映射为 0-100 信用分，并给出每个特征的贡献（可解释）

实现说明
--------
- 纯 Python 手写（sigmoid + 交叉熵损失 + 梯度下降），不依赖 numpy/sklearn，
  便于展示算法细节与迁移部署。
- 训练数据为按业务规则合成、带标签的样本（见 generate_dataset），
  真实生产可无缝替换为从 BorrowRequest / CreditLog / Message 等表抽取的特征。
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import List, Tuple

# ---------------------------------------------------------------- 特征定义
# 8 维行为特征（均为非负数值），维度越高/越异常，风险越大或越小由模型学得。
# 每个特征都能从数据库真实抽取，见 credit_features.extract_features。
FEATURE_NAMES: List[str] = [
    "借药履约率(0-1)",      # f0  完成 / (完成 + 被驳回)，越高越守信
    "被驳回次数",          # f1  借药申请被驳回的次数
    "共享未通过核验",      # f2  共享药品被判不合规的次数
    "共享处方药次数",      # f3  把处方药放进社区共享的次数
    "有效不良反应上报",    # f4  被采纳的上报，越高越可信
    "近30天借药次数",      # f5  适度正常，过高疑似囤药
    "经核验共享次数",      # f6  积极贡献，越高越可信
    "管理员扣分次数",      # f7  被管理员扣分/拉黑的次数
]

# 「真值」权重：仅用于合成训练标签，模型训练时不可见；训练后可与学到的权重对比，
# 证明模型确实从数据中恢复了业务规律（符号一致 = 学到了正确方向）。
_TRUE_WEIGHTS: List[float] = [-4.0, 2.6, 2.2, 2.3, -1.0, 0.35, -0.8, 1.7]
_TRUE_BIAS: float = -0.1

# 每个特征在合成数据时的取值范围上限，用于归一化与采样
_FEATURE_MAX: List[float] = [1.0, 10.0, 5.0, 5.0, 10.0, 20.0, 20.0, 5.0]


@dataclass
class LogisticModel:
    weights: List[float]
    bias: float
    feat_min: List[float]
    feat_max: List[float]
    loss_history: List[float] = field(default_factory=list)

    @staticmethod
    def _sigmoid(z: float) -> float:
        # 数值稳定版 sigmoid，避免 exp 溢出
        if z >= 0:
            e = math.exp(-z)
            return 1.0 / (1.0 + e)
        e = math.exp(z)
        return e / (1.0 + e)

    def _norm(self, features: List[float]) -> List[float]:
        out = []
        for i, x in enumerate(features):
            lo, hi = self.feat_min[i], self.feat_max[i]
            if hi == lo:
                out.append(0.0)
            else:
                # 真实数据可能超出训练集取值范围，裁剪到 [0,1] 避免风险被异常放大
                out.append(max(0.0, min(1.0, (x - lo) / (hi - lo))))
        return out

    def predict_proba(self, features: List[float]) -> float:
        """返回违约概率 p(y=1|x)。"""
        x = self._norm(features)
        z = self.bias + sum(w * xi for w, xi in zip(self.weights, x))
        return float(self._sigmoid(z))

    def contributions(self, features: List[float]) -> List[Tuple[str, float]]:
        """每个特征对违约分的贡献 = weight * 归一化特征值（可解释性）。"""
        x = self._norm(features)
        return list(
            zip(FEATURE_NAMES, [w * xi for w, xi in zip(self.weights, x)])
        )

    def credit_score(self, features: List[float]) -> float:
        """违约概率 → 0-100 信用分（概率越低分越高）。"""
        p = self.predict_proba(features)
        return round(100.0 * (1.0 - p), 1)


def _true_logit(features: List[float]) -> float:
    """按业务真值权重计算违约 logit，用于生成标签。"""
    x = [f / m for f, m in zip(features, _FEATURE_MAX)]
    return _TRUE_BIAS + sum(w * xi for w, xi in zip(_TRUE_WEIGHTS, x))


def generate_dataset(n: int = 2000, seed: int = 42) -> Tuple[List[List[float]], List[int]]:
    """合成带标签数据集：特征 → 是否违约（0/1）。

    按业务直觉采样特征，再以真值 logit 经 sigmoid 决定违约概率、按概率采样标签，
    隐含了「逾期/投诉/违规 → 高风险，按时/诚信 → 低风险」的规律供模型学习。
    """
    rng = random.Random(seed)
    X: List[List[float]] = []
    y: List[int] = []
    for _ in range(n):
        f = [
            rng.uniform(0.3, 1.0),   # 借药履约率
            rng.randint(0, 10),      # 被驳回
            rng.randint(0, 5),       # 共享未通过核验
            rng.randint(0, 5),       # 共享处方药
            rng.randint(0, 10),      # 有效上报
            rng.randint(0, 20),      # 近30天借药
            rng.randint(0, 20),      # 经核验共享
            rng.randint(0, 5),       # 管理员扣分
        ]
        p = LogisticModel._sigmoid(_true_logit(f))
        # 轻微噪声，更贴近真实
        p = max(0.0, min(1.0, p + rng.uniform(-0.03, 0.03)))
        X.append(f)
        y.append(1 if rng.random() < p else 0)
    return X, y


def train(
    X: List[List[float]],
    y: List[int],
    epochs: int = 120,
    lr: float = 0.35,
    seed: int = 7,
) -> LogisticModel:
    """梯度下降训练逻辑回归，返回可复现的模型。"""
    rng = random.Random(seed)
    n_feat = len(FEATURE_NAMES)

    feat_min = [min(row[i] for row in X) for i in range(n_feat)]
    feat_max = [max(row[i] for row in X) for i in range(n_feat)]
    # 归一化后的样本
    Xn = [
        [(row[i] - feat_min[i]) / (feat_max[i] - feat_min[i]) if feat_max[i] != feat_min[i] else 0.0
         for i in range(n_feat)]
        for row in X
    ]

    w = [rng.uniform(-0.1, 0.1) for _ in range(n_feat)]
    b = 0.0
    m = len(X)
    loss_history: List[float] = []

    for _ in range(epochs):
        # 用全部样本做批量梯度下降（数据量小，便于复现）
        total_loss = 0.0
        grad_w = [0.0] * n_feat
        grad_b = 0.0
        for xi, yi in zip(Xn, y):
            z = b + sum(w[j] * xi[j] for j in range(n_feat))
            p = LogisticModel._sigmoid(z)
            err = p - yi
            total_loss += -(yi * math.log(p + 1e-12) + (1 - yi) * math.log(1 - p + 1e-12))
            for j in range(n_feat):
                grad_w[j] += err * xi[j]
            grad_b += err
        for j in range(n_feat):
            w[j] -= lr * grad_w[j] / m
        b -= lr * grad_b / m
        loss_history.append(total_loss / m)

    return LogisticModel(
        weights=w, bias=b, feat_min=feat_min, feat_max=feat_max, loss_history=loss_history
    )


# ------------------------------------------------------------------ 单例
# 首次调用时训练并缓存；训练数据固定 seed，可复现。
_cached_model: LogisticModel | None = None


def get_model() -> LogisticModel:
    global _cached_model
    if _cached_model is None:
        X, y = generate_dataset()
        _cached_model = train(X, y)
    return _cached_model