# P2PQuake intensity API

P2PQuake の `codes=551` 履歴レスポンスを取得し、市町村ごと震度以上に集約して返す API です。

## 起動

```bat
npm.cmd start
```

起動後は `http://localhost:3000/api/intensities` を開きます。

## 返却内容

トップレベル:

- `sourse`: `p2pquake`
- `instisourse`: `気象庁`
- `generatedAt`: 生成日時
- `events`: 地震情報

`sourceUrl` は返しません。

`events[].localIntensities`:

- `cityMaxIntensities`: 市町村ごとの最大震度。同じ市町村が複数ある場合は最大震度を採用
- `areaMaxIntensities`: 細分区域ごとの最大震度。同じ細分区域が複数ある場合は最大震度を採用

震源・震度情報のように `points` が観測点の場合は、市町村と細分区域の両方を作ります。
震度速報のように `points` が細分区域の場合は、市町村は作れないため `cityMaxIntensities` は空になり、`areaMaxIntensities` だけを作ります。

震度は `scale` だけを返します。

## 返却例

```json
{
  "sourse": "p2pquake",
  "instisourse": "気象庁",
  "generatedAt": "2026-05-16T00:00:00.000Z",
  "events": [
    {
      "code": 551,
      "localIntensities": {
        "cityMaxIntensities": [],
        "areaMaxIntensities": []
      }
    }
  ]
}
```
