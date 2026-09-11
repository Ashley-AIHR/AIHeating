from dataclasses import dataclass
from math import isfinite


def finite(name: str, value: float) -> None:
    if not isfinite(value):
        raise ValueError(f"{name} must be finite, got {value}")


def positive(name: str, value: float, *, allow_zero: bool = False) -> None:
    finite(name, value)
    if value < 0 or (not allow_zero and value == 0):
        raise ValueError(f"{name} must be {'nonnegative' if allow_zero else 'positive'}")


@dataclass(frozen=True)
class PhysicalConstants:
    rho_water: float = 998.0  # kg/m³
    cp_water: float = 4180.0  # J/(kg K)
    g: float = 9.80665  # m/s²

    def __post_init__(self):
        for name, value in vars(self).items():
            positive(name, value)


WATER = PhysicalConstants()
