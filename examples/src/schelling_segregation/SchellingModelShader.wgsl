override EMPTY_VALUE: u32 = 999999;

struct Grid {
    values: array<u32>,
};

struct Params {
    width: u32,
    height: u32,
    tolerance: f32
};

@group(0) @binding(6) var<storage, read_write> grid : Grid;
@group(0) @binding(7) var<uniform> params: Params;
@group(0) @binding(8) var<storage, read> randomTable: array<f32>;  // 乱数表
@group(0) @binding(9) var<storage, read_write> emptyGridIndices: array<u32>;  // 空き地インデックス

// 2次元グリッドの(x, y)座標を1次元配列インデックスに変換
fn index(x: u32, y: u32, width: u32) -> u32 {
    return y * width + x;
}

fn random_choice(empty_count: u32, step: u32) -> u32 {
    return u32(floor(randomTable[step] * f32(empty_count)));
}

fn countSimilarNeighbors(x: u32, y: u32, width: u32, height: u32, agentType: u32) -> vec2u {
    var similar_count: u32 = 0;
    var neighbor_count: u32 = 0;
    for (var dy: u32 = 0; dy < 2; dy++) {
        for (var dx: u32 = 0; dx < 2; dx++) {
            if (dx == 0 && dy == 0) {
                continue;
            }
            let neighbor_x = (x + dx + width) % width;
            let neighbor_y = (y + dy + height) % height;
            let neighbor_index = index(neighbor_x, neighbor_y, width);
            let current = grid.values[neighbor_index];
            if (current == agentType) {
                similar_count += 1;
            } else if (current != EMPTY_VALUE) {
                neighbor_count += 1;
            }
        }
    }
    return vec2u(similar_count, neighbor_count);
}

@compute @workgroup_size(1)
fn main() {
 for(var y = 0u; y < params.height; y++){
  for(var x = 0u; x < params.width; x++){
    let currentIndex = index(x, y, params.width);
    let agentType = grid.values[currentIndex];
    // エージェントが存在しない場所 (空き地) はスキップ
    if (agentType == EMPTY_VALUE) {
        continue;
    }
    // 似たエージェントがどれだけいるかカウント
    let count = countSimilarNeighbors(x, y, params.width, params.height, agentType);
    let similarCount = count.x;
    let neighborCount = count.y;

    // 閾値に基づいて、引越しを決定
    let similarityRatio = f32(similarCount) / f32(neighborCount);

    // 引越しが必要かどうか
    if (neighborCount > 0u &&  similarityRatio < params.tolerance) {
        let randomIndex = random_choice(arrayLength(&emptyGridIndices), currentIndex);
        let emptyIndex = emptyGridIndices[randomIndex];
        emptyGridIndices[randomIndex] = currentIndex;
        grid.values[emptyIndex] = agentType;
        grid.values[currentIndex] = EMPTY_VALUE; // 元の場所は空き地にする
    }else{
        grid.values[currentIndex] = agentType;
    }
   }
  }
}
