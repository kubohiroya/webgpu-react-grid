override EMPTY_VALUE: u32 = 99999;

struct Grid {
    values: array<u32>,
};

struct Params {
    width: u32,
    height: u32,
    emptyGridIndicesSize: u32,
    tolerance: f32
};

@group(0) @binding(6) var<storage, read_write> grid : Grid;
@group(0) @binding(7) var<uniform> params: Params;
@group(0) @binding(8) var<storage, read> randomTable: array<f32>;  // 乱数表
@group(0) @binding(9) var<storage, read_write> emptyGridIndices: array<u32>;  // 空き地インデックス

// 2次元グリッドの(x, y)座標を1次元配列インデックスに変換
fn getIndex(x: u32, y: u32, width: u32) -> u32 {
  return y * width + x;
}

fn getCell(x: u32, y: u32) -> u32 {
  return grid.values[getIndex(x, y, params.width)];
}

fn countSimilarNeighbor(x: i32, y: i32, width: i32, height: i32, agentType: u32) -> vec2u {
  let cell = getCell(u32((x + width) % width), u32((y + height) % height));
  return vec2u(select(0u, 1u, cell == agentType), select(0u, 1u, cell != EMPTY_VALUE));
}

fn randomChoice(size: u32, step: u32) -> u32 {
    return u32(floor(randomTable[step] * f32(size)));
}

fn countSimilarNeighbors(x: i32, y: i32, width: i32, height: i32, agentType: u32) -> vec2u {
    return countSimilarNeighbor(x - 1, y - 1, width, height, agentType) +
          countSimilarNeighbor(x, y - 1, width, height, agentType) +
          countSimilarNeighbor(x + 1, y - 1, width, height, agentType) +
          countSimilarNeighbor(x - 1, y, width, height, agentType) +
          countSimilarNeighbor(x + 1, y, width, height, agentType) +
          countSimilarNeighbor(x - 1, y + 1, width, height, agentType) +
          countSimilarNeighbor(x, y + 1, width, height, agentType) +
          countSimilarNeighbor(x + 1, y + 1, width, height, agentType);
}

fn computeMain(x: u32, y: u32) {
    let currentIndex = getIndex(x, y, params.width);
    let currentValue = grid.values[currentIndex];
    // エージェントが存在しない場所 (空き地) はスキップ
    if (currentValue == EMPTY_VALUE) {
      return;
    }
    // 似たエージェントがどれだけいるかカウント
    let neighbors = countSimilarNeighbors(i32(x), i32(y), i32(params.width), i32(params.height), currentValue);
    let similarCount = neighbors.x;
    let neighborCount = neighbors.y;

    // 閾値に基づいて、引越しを決定
    if (neighborCount > 0u && f32(similarCount) / f32(neighborCount) < params.tolerance) {
        let randomIndex = randomChoice(params.emptyGridIndicesSize, currentIndex);
        let targetIndex = emptyGridIndices[randomIndex];
        let targetValue = grid.values[targetIndex];
        if(targetValue == EMPTY_VALUE) {
            emptyGridIndices[randomIndex] = currentIndex;
            grid.values[targetIndex] = currentValue;
            grid.values[currentIndex] = EMPTY_VALUE;
        }
    }
}

@compute @workgroup_size(1)
fn main() {
 for(var y = 0u; y < params.height; y++){
  for(var x = 0u; x < params.width; x++){
    computeMain(x, y);
   }
  }
}
