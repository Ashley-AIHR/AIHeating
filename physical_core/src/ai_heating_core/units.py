"""All SI ↔ presentation conversions. Physics modules use SI only."""


def minutes_to_seconds(value: float) -> float:
    return value * 60


def seconds_to_minutes(value: float) -> float:
    return value / 60


def hours_to_seconds(value: float) -> float:
    return value * 3600


def seconds_to_hours(value: float) -> float:
    return value / 3600


def m3h_to_m3s(value: float) -> float:
    return value / 3600


def m3s_to_m3h(value: float) -> float:
    return value * 3600


def pa_to_kpa(value: float) -> float:
    return value / 1000


def kpa_to_pa(value: float) -> float:
    return value * 1000


def w_to_kw(value: float) -> float:
    return value / 1000


def w_to_mw(value: float) -> float:
    return value / 1e6


def j_to_kwh(value: float) -> float:
    return value / 3.6e6


def j_to_mwh(value: float) -> float:
    return value / 3.6e9


def percent_to_fraction(value: float) -> float:
    return value / 100


def fraction_to_percent(value: float) -> float:
    return value * 100
