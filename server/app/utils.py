"""通用工具：有效期状态计算、距离展示等。"""

from datetime import datetime

EXPIRING_THRESHOLD_DAYS = 30


def calc_expiry_status(expiry_date: str, threshold_days: int = EXPIRING_THRESHOLD_DAYS) -> str:
    """按距有效期的剩余天数分级：normal / expiring / expired。"""
    if not expiry_date:
        return "normal"
    try:
        target = datetime.strptime(expiry_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return "normal"
    delta = (target - datetime.now().date()).days
    if delta < 0:
        return "expired"
    if delta <= threshold_days:
        return "expiring"
    return "normal"


def days_left(expiry_date: str):
    """距有效期剩余天数，解析失败返回 None。"""
    if not expiry_date:
        return None
    try:
        target = datetime.strptime(expiry_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    return (target - datetime.now().date()).days


def fake_distance(my_building: str, other_building: str) -> str:
    """演示用的距离展示：同楼栋直接标注，否则按楼栋名生成一个稳定的模拟值。"""
    if my_building and my_building == other_building:
        return "同楼栋"
    seed = sum(ord(c) for c in (other_building or "未知"))
    meters = 50 + (seed * 7) % 450
    return f"{meters}m"
