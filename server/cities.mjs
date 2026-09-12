// Climate context is sourced; every scenario value is a synthetic design input.
export const cities = {
  yinchuan: {
    id: "yinchuan",
    name: "Yinchuan",
    localName: "银川",
    district: "Winter-city energy district",
    system: "Residential secondary heating",
    climate: "Northern inland winter-heating context",
    source:
      "https://www.yinchuan.gov.cn/xwzx/mrdt/202511/t20251102_5072056.html",
    scope:
      "Fictional Yinchuan-inspired district; authored geometry and simulated operating data, not a surveyed reconstruction.",
    geometryRevision: "vision-winter-2026-09-13",
    initialSupplyC: 52,
    initialPumpHz: 45,
    windMs: 3.4,
    weather: {
      imbalance: [-8, 45],
      warming: [-3, 240],
      cold: [-14, 15],
      sensor: [-8, 45],
      window: [-8, 45],
    },
  },
  shanghai: {
    id: "shanghai",
    name: "Shanghai",
    localName: "上海",
    district: "Riverside neighbourhood energy district",
    system: "Low-temperature neighbourhood loop · heating mode",
    climate: "Humid subtropical monsoon; hot summers and cold winters",
    source: "https://tjj.sh.gov.cn/zrdl/20180819/0014-216816.html",
    technologySource:
      "https://shgtzy.xml-data.cn/article/id/ab3c784e-ca6f-4f87-9e81-32a01974af2d",
    scope:
      "Fictional Shanghai-inspired riverside neighbourhood with a conceptual heat-pump-fed water loop. Authored geometry, synthetic weather and shared aggregate building archetypes; no surveyed site or live data.",
    geometryRevision: "vision-shanghai-riverside-2026-09-13",
    initialSupplyC: 44,
    initialPumpHz: 40,
    windMs: 2.8,
    weather: {
      imbalance: [5, 60],
      warming: [8, 180],
      cold: [0, 25],
      sensor: [5, 60],
      window: [5, 60],
    },
  },
};
export function cityProfile(id = "yinchuan") {
  if (!Object.hasOwn(cities, id)) throw Error("Unknown city");
  return cities[id];
}
