"""Adiabatic volume FIFO. Outlet segments preserve within-step arrival times."""
from collections import deque
from dataclasses import dataclass
from math import fsum

from .constants import WATER, PhysicalConstants, finite, positive


@dataclass(frozen=True)
class OutletSegment:
    duration_s: float
    temperature_c: float


class DelayLine:
    def __init__(self, volume_m3: float, initial_c: float):
        positive("equivalent pipe volume", volume_m3)
        finite("initial pipe temperature", initial_c)
        self.equivalent_volume_m3 = volume_m3
        self.packets = deque([(volume_m3, initial_c)])
        self.delivered_supply_c = initial_c
        self.current_flow_m3_s = 0.0

    @property
    def estimated_delay_s(self):
        # Undefined at zero flow; do not invent a finite physical delay.
        return self.equivalent_volume_m3 / self.current_flow_m3_s if self.current_flow_m3_s else None

    @property
    def volume_m3(self):
        return fsum(v for v, _ in self.packets)

    def energy_j(self, water: PhysicalConstants = WATER):
        # Sensible energy relative to 0°C; only differences enter balances.
        return water.rho_water * water.cp_water * fsum(v * t for v, t in self.packets)

    def advance(self, inlet_c: float, flow_m3_s: float, dt_s: float) -> list[OutletSegment]:
        finite("inlet temperature", inlet_c)
        positive("transport flow", flow_m3_s, allow_zero=True)
        positive("transport dt", dt_s)
        self.current_flow_m3_s = flow_m3_s
        if flow_m3_s == 0:
            return [OutletSegment(dt_s, self.delivered_supply_c)]
        incoming = flow_m3_s * dt_s
        if self.packets[-1][1] == inlet_c:
            v, t = self.packets.pop()
            self.packets.append((v + incoming, t))
        else:
            self.packets.append((incoming, inlet_c))
        remaining = incoming
        segments = []
        while remaining > 0:
            volume, temperature = self.packets.popleft()
            taken = min(volume, remaining)
            segments.append(OutletSegment(taken / flow_m3_s, temperature))
            remaining -= taken
            if taken < volume:
                self.packets.appendleft((volume - taken, temperature))
        self.delivered_supply_c = fsum(s.duration_s * s.temperature_c for s in segments) / dt_s
        if abs(self.volume_m3 - self.equivalent_volume_m3) > 1e-10 * self.equivalent_volume_m3:
            raise ArithmeticError("transport volume conservation failed")
        return segments
