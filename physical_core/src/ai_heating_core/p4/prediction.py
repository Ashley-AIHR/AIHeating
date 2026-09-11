"""Small provider seam shared by offline evaluation and the Preview."""
from dataclasses import dataclass
from typing import Protocol

import numpy as np


FORBIDDEN_TOKENS = ("episode_id", "parameter_set", "scenario_variant", "scenario_family",
                    "split", "seed", "future_truth", "target_required", "target_indoor")


def assert_causal_feature_names(feature_names):
    bad = [name for name in feature_names if any(token in name.lower() for token in FORBIDDEN_TOKENS)]
    if bad:
        raise ValueError(f"Forbidden prediction-time features: {bad}")


@dataclass(frozen=True)
class PredictionInput:
    horizon_minutes: int
    features: dict[str, float]


@dataclass(frozen=True)
class LoadPrediction:
    point_mw: float
    lower_mw: float | None
    upper_mw: float | None
    horizon_minutes: int
    model_version: str
    confidence: str


class PredictionProvider(Protocol):
    def predict_required_heat(self, request: PredictionInput) -> LoadPrediction: ...
    def metadata(self) -> dict[str, object]: ...


class PersistenceLoadPredictor:
    version = "persistence-load-v1"

    def predict_required_heat(self, request):
        return LoadPrediction(request.features["current_required_load_mw"], None, None,
                              request.horizon_minutes, self.version, "point-only")

    def metadata(self):
        return {"modelType": "Persistence", "version": self.version}


class PhysicsLoadPredictorV0:
    version = "physics-load-predictor-v0"

    def predict_required_heat(self, request):
        return LoadPrediction(request.features["physics_forecast_load_mw"], None, None,
                              request.horizon_minutes, self.version, "point-only")

    def metadata(self):
        return {"modelType": "Physics Predictor v0", "version": self.version,
                "requiredLoadHelper": "ai_heating_core.thermal.required_load"}


class ModelLoadPredictor:
    def __init__(self, models, feature_names, version, intervals=None):
        assert_causal_feature_names(feature_names)
        self.models, self.feature_names, self.version = models, tuple(feature_names), version
        self.intervals = intervals or {}

    def predict_required_heat(self, request):
        model = self.models[request.horizon_minutes]
        vector = np.array([[request.features[name] for name in self.feature_names]])
        point = max(0.0, float(model.predict(vector)[0]))
        width = self.intervals.get(request.horizon_minutes)
        return LoadPrediction(point, max(0.0, point - width) if width is not None else None,
            point + width if width is not None else None, request.horizon_minutes, self.version,
            "95% simulation-calibrated" if width is not None else "point-only")

    def metadata(self):
        return {"modelType": type(self).__name__, "version": self.version,
                "featureCount": len(self.feature_names), "intervals": self.intervals}


class LinearRegressionLoadPredictorV1(ModelLoadPredictor):
    pass


class LightGBMLoadPredictorV1(ModelLoadPredictor):
    pass


class SelectedLoadPredictorV1(ModelLoadPredictor):
    def __init__(self, selected_type, models, feature_names, intervals):
        super().__init__(models, feature_names, "selected-p4-predictor-v1", intervals)
        self.selected_type = selected_type

    def metadata(self):
        return {**super().metadata(), "selectedModelType": self.selected_type,
                "displayName": "Selected P4 Predictor v1"}

