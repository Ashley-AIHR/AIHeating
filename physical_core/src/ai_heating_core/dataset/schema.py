"""Logical schema for deterministic gzip-CSV P3 tables."""
from . import DATASET_VERSION


def field(name, type_, unit, table, source, description, classification):
    return {"name": name, "type": type_, "unit": unit, "nullable": False,
            "table": table, "source": source, "semanticDescription": description,
            "classification": classification}


IDENTITY = [
    ("dataset_version", "string", "id", "dataset lineage", "Dataset version", "metadata"),
    ("episode_id", "string", "id", "episode descriptor", "Unique episode identity", "metadata"),
    ("split", "string", "category", "split manager", "Dataset partition", "metadata"),
    ("scenario_family", "string", "category", "scenario variant", "Canonical scenario family", "metadata"),
    ("scenario_variant_id", "string", "id", "scenario variant", "Unique scenario variant identity", "metadata"),
    ("physical_fixture_base_version", "string", "id", "freeze manifest", "Accepted fixture base version", "metadata"),
    ("parameter_set_id", "string", "id", "parameter sampler", "Derived physical parameter-set identity", "metadata"),
    ("parameter_set_hash", "string", "sha256", "parameter sampler", "Hash of complete physical parameter set", "metadata"),
    ("controller_version", "string", "id", "frozen controller", "Traditional controller version", "metadata"),
    ("scenario_version", "string", "id", "scenario variant", "Scenario definition version", "metadata"),
    ("generator_version", "string", "id", "dataset factory", "Dataset generator version", "metadata"),
    ("seed", "int64", "integer", "split manager", "Deterministic episode seed", "metadata"),
    ("simulation_time", "timestamp", "ISO-8601", "accepted simulation clock", "Current/as-of simulation time", "metadata"),
]


TABLE_FIELDS = {
    "raw_state": IDENTITY + [
        ("elapsed_minutes", "float64", "min", "frame.elapsed_s", "Evaluation elapsed time", "feature"),
        ("local_hour", "float64", "h", "simulation clock", "Local decimal hour", "feature"),
        ("day_fraction", "float64", "1", "simulation clock", "Elapsed fraction of evaluation day", "feature"),
        ("outdoor_temperature_c", "float64", "degC", "frame.weather", "Current outdoor truth", "feature"),
        ("solar_radiation_w_m2", "float64", "W/m2", "frame.weather", "Current solar truth", "feature"),
        ("wind_m_s", "float64", "m/s", "frame.weather", "Current wind truth; context-only in accepted physics", "feature"),
        ("supply_setpoint_c", "float64", "degC", "frame.controls", "Applied supply setpoint", "feature"),
        ("pump_frequency_hz", "float64", "Hz", "frame.controls", "Applied pump frequency", "feature"),
        ("near_valve_pct", "float64", "%", "frame.controls", "Fixed Near valve opening", "feature"),
        ("mid_valve_pct", "float64", "%", "frame.controls", "Fixed Mid valve opening", "feature"),
        ("far_valve_pct", "float64", "%", "frame.controls", "Fixed Far valve opening", "feature"),
        ("total_flow_m3_h", "float64", "m3/h", "frame.hydraulics", "Total solved volumetric flow", "feature"),
        ("near_flow_m3_h", "float64", "m3/h", "frame.hydraulics", "Near solved flow", "feature"),
        ("mid_flow_m3_h", "float64", "m3/h", "frame.hydraulics", "Mid solved flow", "feature"),
        ("far_flow_m3_h", "float64", "m3/h", "frame.hydraulics", "Far solved flow", "feature"),
        ("pump_pressure_kpa", "float64", "kPa", "frame.hydraulics", "Solved pump pressure", "feature"),
        ("transport_delay_near_min", "float64", "min", "frame.delay_s", "Estimated Near FIFO delay", "feature"),
        ("transport_delay_mid_min", "float64", "min", "frame.delay_s", "Estimated Mid FIFO delay", "feature"),
        ("transport_delay_far_min", "float64", "min", "frame.delay_s", "Estimated Far FIFO delay", "feature"),
        ("delivered_supply_near_c", "float64", "degC", "frame.delivered_supply_c", "Near delivered supply", "feature"),
        ("delivered_supply_mid_c", "float64", "degC", "frame.delivered_supply_c", "Mid delivered supply", "feature"),
        ("delivered_supply_far_c", "float64", "degC", "frame.delivered_supply_c", "Far delivered supply", "feature"),
        ("return_near_c", "float64", "degC", "frame.zone_return_c", "Near return temperature", "feature"),
        ("return_mid_c", "float64", "degC", "frame.zone_return_c", "Mid return temperature", "feature"),
        ("return_far_c", "float64", "degC", "frame.zone_return_c", "Far return temperature", "feature"),
        ("station_return_c", "float64", "degC", "frame.station_return_c", "Station mixed return", "feature"),
        ("required_heat_load_mw", "float64", "MW", "frame.required_heat_w", "Accepted instantaneous required heat load", "feature"),
        ("actual_heat_supply_mw", "float64", "MW", "frame.actual_heat_w", "Accepted delivered radiator heat", "feature"),
        ("pump_power_kw", "float64", "kW", "frame.hydraulics", "Pump electric power", "feature"),
        ("cumulative_heat_mwh", "float64", "MWh", "frame heat accumulator", "Evaluation-only cumulative delivered heat", "feature"),
        ("cumulative_pump_kwh", "float64", "kWh", "frame pump accumulator", "Evaluation-only cumulative pump electricity", "feature"),
        ("hydraulic_converged", "boolean", "1", "frame.hydraulics.solver", "Hydraulic convergence flag", "diagnostic"),
        ("hydraulic_residual", "float64", "1", "frame.hydraulics.solver", "Normalized hydraulic residual", "diagnostic"),
        ("mass_residual", "float64", "1", "frame.mass_residual", "Normalized mass residual", "diagnostic"),
        ("heat_balance_residual", "float64", "1", "frame.heat_balance_residual", "Normalized water/building heat residual", "diagnostic"),
    ],
    "building_state": IDENTITY + [
        ("building_id", "string", "id", "building profile", "Building identity", "metadata"),
        ("zone", "string", "category", "building profile", "Hydraulic zone", "metadata"),
        ("area_m2", "float64", "m2", "building profile", "Heated area", "feature"),
        ("thermal_resistance_k_w", "float64", "K/W", "building profile", "Envelope thermal resistance", "feature"),
        ("envelope_conductance_w_k", "float64", "W/K", "building profile", "Inverse envelope resistance", "feature"),
        ("thermal_capacitance_j_k", "float64", "J/K", "building profile", "Effective thermal capacitance", "feature"),
        ("radiator_ua_w_k", "float64", "W/K", "building profile", "Derived radiator UA including permitted sizing margin", "feature"),
        ("design_flow_kg_s", "float64", "kg/s", "building profile flow_share_weight", "Coherent design mass flow", "feature"),
        ("indoor_temperature_c", "float64", "degC", "building state", "End-of-step indoor temperature", "feature"),
        ("delivered_supply_temperature_c", "float64", "degC", "frame delivered supply", "Zone delivered supply", "feature"),
        ("allocated_flow_m3_h", "float64", "m3/h", "building state", "Allocated building volumetric flow", "feature"),
        ("radiator_heat_kw", "float64", "kW", "building state", "Interval-mean radiator heat", "feature"),
        ("required_heat_kw", "float64", "kW", "accepted required_load", "Instantaneous building required heat at 21C", "feature"),
        ("solar_gain_kw", "float64", "kW", "building state", "Interval solar gain", "feature"),
        ("internal_gain_kw", "float64", "kW", "building state", "Internal gain", "feature"),
        ("envelope_loss_kw", "float64", "kW", "building state", "Envelope heat loss at interval mean indoor temperature", "feature"),
        ("underheat", "boolean", "1", "derived current state", "Indoor temperature below 18C", "feature"),
        ("comfort", "boolean", "1", "derived current state", "Indoor temperature within 20–22C", "feature"),
        ("overheat", "boolean", "1", "derived current state", "Indoor temperature above 23C", "feature"),
    ],
    "weather_forecast": IDENTITY + [
        ("forecast_as_of", "timestamp", "ISO-8601", "forecast anchor", "Forecast issue time", "metadata"),
        ("forecast_target_time", "timestamp", "ISO-8601", "forecast horizon", "Forecast valid time", "metadata"),
        ("horizon_minutes", "int64", "min", "forecast horizon", "Minutes from issue to target", "metadata"),
        ("forecast_outdoor_temperature_c", "float64", "degC", "synthetic forecast model", "Outdoor forecast, not future truth", "feature"),
        ("forecast_solar_radiation_w_m2", "float64", "W/m2", "synthetic forecast model", "Solar forecast, not future truth", "feature"),
        ("forecast_wind_m_s", "float64", "m/s", "synthetic forecast model", "Wind forecast, not future truth", "feature"),
        ("forecast_model_version", "string", "id", "synthetic forecast model", "Forecast error-model version", "metadata"),
        ("forecast_seed", "int64", "integer", "split manager", "Deterministic forecast seed", "metadata"),
    ],
    "load_target": IDENTITY + [
        ("as_of_time", "timestamp", "ISO-8601", "target anchor", "Prediction anchor time", "metadata"),
        ("target_time", "timestamp", "ISO-8601", "future frame", "Future truth time", "metadata"),
        ("horizon_minutes", "int64", "min", "target horizon", "Prediction horizon", "metadata"),
        ("required_heat_load_mw", "float64", "MW", "future frame.required_heat_w", "Accepted future required-load truth", "label"),
    ],
    "building_temperature_target": IDENTITY + [
        ("building_id", "string", "id", "building profile", "Building identity", "metadata"),
        ("as_of_time", "timestamp", "ISO-8601", "target anchor", "Prediction anchor time", "metadata"),
        ("target_time", "timestamp", "ISO-8601", "future frame", "Future truth time", "metadata"),
        ("horizon_minutes", "int64", "min", "target horizon", "Prediction horizon", "metadata"),
        ("indoor_temperature_c", "float64", "degC", "future building state", "Future indoor-temperature truth", "label"),
    ],
}


def schema_document():
    return {"datasetVersion": DATASET_VERSION, "schemaVersion": "p3-schema-v1.0",
            "storageFormat": "gzip-compressed RFC 4180 CSV, UTF-8, one episode per shard",
            "tables": {table: {"columns": columns(table)} for table in TABLE_FIELDS},
            "fields": [field(name, type_, unit, table, source, description, classification)
                       for table, definitions in TABLE_FIELDS.items()
                       for name, type_, unit, source, description, classification in definitions]}


def columns(table):
    return [definition[0] for definition in TABLE_FIELDS[table]]
