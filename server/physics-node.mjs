/** Native Node port of the accepted P1A fixture. No Python runtime or numerical package.
 * The parallel-branch quadratic hydraulic equations admit an exact positive solution.
 * Thermal integration and FIFO water packets preserve the original energy accounting.
 */
import { readFileSync } from "node:fs";
export const p = JSON.parse(
  readFileSync(new URL("./physical-fixture.json", import.meta.url)),
);
export const zones = ["near", "mid", "far"];
const { rho_water: rho, cp_water: cp, g } = p.water;
const sum = (a) => a.reduce((x, y) => x + y, 0);
export function validate(c, previous) {
  const a = [c.supplyC, c.pumpHz, ...(c.valvesPct || [])],
    lo = [40, 30, 20, 20, 20],
    hi = [60, 50, 100, 100, 100];
  if (a.length !== 5) throw Error("valvesPct requires exactly three values");
  a.forEach((v, i) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo[i] || v > hi[i])
      throw Error("Control must be finite and within equipment bounds");
  });
  if (previous) {
    const b = [previous.supplyC, previous.pumpHz, ...previous.valvesPct];
    a.forEach((v, i) => {
      if (Math.abs(v - b[i]) > [2, 2, 10, 10, 10][i] + 1e-10)
        throw Error("Control change exceeds permitted ramp");
    });
  }
  return structuredClone(c);
}
export function hydraulics(c, openings = {}, design = {}) {
  const k = p.branches.map(
    (b, i) =>
      (b.pipe_k_pa_s2_m6 * (design.branchResistance?.[zones[i]] || 1) +
        b.valve_ref_k_pa_s2_m6 / (c.valvesPct[i] / 100) ** 2) *
      (() => {
        const bs = p.buildings.filter((v) => v.zone === zones[i]);
        // Normalised equivalent parallel-building resistance. At 100% this
        // exactly recovers the accepted fixture; it is not surveyed pipework.
        return (
          (sum(bs.map((v) => v.flow_share_weight)) /
            sum(
              bs.map(
                (v) =>
                  (v.flow_share_weight * (openings[v.building_id] ?? 100)) /
                  100,
              ),
            )) **
          2
        );
      })(),
  );
  const shut =
    rho *
    g *
    p.pump.shutoff_head_m *
    (c.pumpHz / p.pump.reference_frequency_hz) ** 2;
  const coupled = rho * g * p.pump.curve_a_s2_m5 + p.common_k_pa_s2_m6;
  const available =
    shut / (1 + coupled * sum(k.map((v) => 1 / Math.sqrt(v))) ** 2);
  const flows = k.map((v) => Math.sqrt(available / v)),
    total = sum(flows);
  const pumpPressure =
    rho *
    g *
    (p.pump.shutoff_head_m * (c.pumpHz / p.pump.reference_frequency_hz) ** 2 -
      p.pump.curve_a_s2_m5 * total ** 2);
  return {
    flows,
    total,
    available,
    power: (pumpPressure * total) / p.pump.efficiency,
    residual: Math.max(
      ...flows.map(
        (q, i) =>
          Math.abs(shut - coupled * total ** 2 - k[i] * q * q) /
          Math.max(shut, 1),
      ),
    ),
  };
}
export function createEngine(controls, temperatures) {
  return {
    controls: validate(controls),
    temperatures,
    elapsed: 0,
    heatJ: 0,
    pumpJ: 0,
    buffers: p.branches.map((b) => ({
      packets: [[b.equivalent_volume_m3, controls.supplyC]],
      delivered: controls.supplyC,
    })),
  };
}
function transport(buffer, inlet, flow, dt) {
  if (!flow) return [[dt, buffer.delivered]];
  const amount = flow * dt,
    last = buffer.packets.at(-1);
  if (last?.[1] === inlet) last[0] += amount;
  else buffer.packets.push([amount, inlet]);
  let remaining = amount;
  const outlets = [];
  while (remaining > 1e-12) {
    const packet = buffer.packets[0],
      take = Math.min(packet[0], remaining);
    outlets.push([take / flow, packet[1]]);
    remaining -= take;
    packet[0] -= take;
    if (packet[0] < 1e-12) buffer.packets.shift();
  }
  buffer.delivered = sum(outlets.map(([t, c]) => t * c)) / dt;
  return outlets;
}
function linear(t, eq, conductance, cap, dt) {
  const x = (conductance / cap) * dt,
    change = -Math.expm1(-x);
  return [t + (eq - t) * change, eq + ((t - eq) * change) / x];
}
function building(profile, initial, outlets, mass, w, window, auxiliaryW = 0) {
  const solar =
    w.solar * profile.effective_solar_area_m2 * profile.orientation_factor;
  const internal = profile.internal_gain_w,
    loss =
      1 / profile.thermal_resistance_k_w +
      profile.window_conductance_w_k * window;
  const forcing = solar + internal + auxiliaryW + loss * w.outdoor,
    cap = profile.thermal_capacitance_j_k;
  const conductance =
    mass > 0
      ? -mass * cp * Math.expm1(-profile.radiator_ua_w_k / (mass * cp))
      : 0;
  let temp = initial,
    integral = 0,
    heatEnergy = 0;
  for (const [dt, supply] of outlets) {
    let remaining = dt;
    for (let part = 0; part < 2 && remaining > 1e-9; part++) {
      const active =
        temp < supply || (temp === supply && forcing - loss * supply < 0);
      const emitter = active ? conductance : 0,
        G = loss + emitter,
        eq = (forcing + emitter * supply) / G;
      let duration = remaining,
        [end, mean] = linear(temp, eq, G, cap, duration);
      if ((temp - supply) * (end - supply) < 0) {
        duration = (-cap / G) * Math.log((supply - eq) / (temp - eq));
        [, mean] = linear(temp, eq, G, cap, duration);
        end = supply;
      }
      integral += mean * duration;
      heatEnergy += emitter * Math.max(supply - mean, 0) * duration;
      remaining -= duration;
      temp = end;
    }
  }
  const dt = sum(outlets.map((v) => v[0])),
    mean = integral / dt,
    heat = heatEnergy / dt;
  const supply = sum(outlets.map(([t, c]) => t * c)) / dt;
  const envelope = (mean - w.outdoor) / profile.thermal_resistance_k_w;
  const windowLoss =
      profile.window_conductance_w_k * window * (mean - w.outdoor),
    storage = (cap * (temp - initial)) / dt;
  return {
    temp,
    heat,
    solar,
    internal,
    envelope,
    windowLoss,
    storage,
    auxiliaryW,
    mass,
    returnC: mass ? supply - heat / (mass * cp) : supply,
    residual:
      storage - (heat + solar + internal + auxiliaryW - envelope - windowLoss),
    required: Math.max(
      0,
      loss * (p.target_indoor_c - w.outdoor) - solar - internal,
    ),
  };
}
export function step(engine, w, change, windows = {}) {
  const dt = 300,
    c = validate(change || engine.controls, engine.controls);
  if (
    change &&
    JSON.stringify(c) !== JSON.stringify(engine.controls) &&
    engine.elapsed % 1800
  )
    throw Error("Control changes require a 30-minute boundary");
  const design = engine.design || {};
  const openings = Object.fromEntries(
    p.buildings.map((b) => {
      const id = b.building_id;
      if (!design.localValves) return [id, 100];
      const desired =
        design.manualValves?.[id] ??
        Math.max(
          1,
          Math.min(
            100,
            40 +
              80 * ((design.setpoints?.[id] ?? 21) - engine.temperatures[id]),
          ),
        );
      const old = engine.localOpenings?.[id] ?? 100;
      return [id, Math.max(old - 10, Math.min(old + 10, desired))];
    }),
  );
  const h = hydraulics(c, openings, design),
    buffers = structuredClone(engine.buffers);
  const energy = (bs) =>
    rho * cp * sum(bs.flatMap((b) => b.packets.map(([v, t]) => v * t)));
  const before = energy(buffers),
    buildings = {},
    branch = [];
  for (let i = 0; i < 3; i++) {
    const profiles = p.buildings.filter((b) => b.zone === zones[i]),
      weight = sum(
        profiles.map(
          (b) => (b.flow_share_weight * openings[b.building_id]) / 100,
        ),
      );
    const outlets = transport(buffers[i], c.supplyC, h.flows[i], dt);
    for (const original of profiles) {
      const id = original.building_id,
        amendment = design.buildings?.[id] || {};
      const b = {
        ...original,
        radiator_ua_w_k:
          original.radiator_ua_w_k * (amendment.emitterFactor || 1),
        thermal_resistance_k_w:
          original.thermal_resistance_k_w / (amendment.lossFactor || 1),
      };
      const mass =
        (rho * h.flows[i] * b.flow_share_weight * openings[id]) / 100 / weight;
      const evaluate = (power) =>
        building(
          b,
          engine.temperatures[id],
          outlets,
          mass,
          w,
          windows[id] || 0,
          power,
        );
      let result = evaluate(0);
      if (
        amendment.auxiliaryKw > 0 &&
        result.temp < (amendment.targetC ?? 21)
      ) {
        let lo = 0,
          hi = amendment.auxiliaryKw * 1000;
        for (let j = 0; j < 16; j++) {
          const mid = (lo + hi) / 2;
          if (evaluate(mid).temp < (amendment.targetC ?? 21)) lo = mid;
          else hi = mid;
        }
        result = evaluate(hi);
      }
      buildings[id] = { ...result, localValvePct: openings[id] };
    }
    branch.push({
      id: zones[i],
      flowM3h: h.flows[i] * 3600,
      valvePct: c.valvesPct[i],
      delayMinutes: p.branches[i].equivalent_volume_m3 / h.flows[i] / 60,
      supplyC: buffers[i].delivered,
      returnC:
        sum(
          profiles.map(
            (b) =>
              buildings[b.building_id].mass * buildings[b.building_id].returnC,
          ),
        ) /
        (rho * h.flows[i]),
    });
  }
  const values = Object.values(buildings),
    heat = sum(values.map((b) => b.heat)),
    load = sum(values.map((b) => b.required));
  const returnC = sum(branch.map((b, i) => b.returnC * h.flows[i])) / h.total;
  const delivered = sum(branch.map((b, i) => b.supplyC * h.flows[i])) / h.total;
  const source = rho * h.total * cp * (c.supplyC - returnC),
    pipeStorage = (energy(buffers) - before) / dt;
  const residual = Math.max(
    Math.abs(heat - rho * h.total * cp * (delivered - returnC)) /
      Math.max(Math.abs(heat), 1),
    Math.abs(source - heat - pipeStorage) / Math.max(Math.abs(source), 1),
    ...values.map(
      (b) =>
        Math.abs(b.residual) /
        Math.max(
          Math.abs(b.heat) +
            Math.abs(b.solar) +
            Math.abs(b.internal) +
            Math.abs(b.auxiliaryW) +
            Math.abs(b.envelope) +
            Math.abs(b.windowLoss),
          1,
        ),
    ),
  );
  if (!Number.isFinite(residual) || residual > 1e-7)
    throw Error("Physical energy-balance verification failed");
  engine.controls = c;
  engine.localOpenings = openings;
  engine.buffers = buffers;
  engine.elapsed += dt;
  engine.heatJ += heat * dt;
  engine.pumpJ += h.power * dt;
  engine.auxiliaryJ =
    (engine.auxiliaryJ || 0) + sum(values.map((b) => b.auxiliaryW)) * dt;
  engine.temperatures = Object.fromEntries(
    Object.entries(buildings).map(([id, b]) => [id, b.temp]),
  );
  return {
    buildings,
    branch,
    h,
    heat,
    load,
    returnC,
    source,
    pipeStorage,
    residual,
    w,
  };
}
