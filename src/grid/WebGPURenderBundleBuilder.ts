import {
  createF32UniformBufferSource,
  createUniformBuffer,
  updateBuffer,
  createUint32BufferSource,
  createStorageBuffer,
  createVertexBuffer,
} from './WebGPUBufferFactories';
import { GridContextProps } from './GridContext';
import cellShaderCode from './CellShader.wgsl?raw';
import { CanvasElementContextValue } from './CanvasElementContext';
import { gridCellVertices } from './GridCellVertices';

export class WebGPURenderBundleBuilder {
  device: GPUDevice;
  canvasElementContext: CanvasElementContextValue;
  canvasFormat: GPUTextureFormat;
  bindGroupLayout: GPUBindGroupLayout;
  bindGroup: GPUBindGroup | undefined;
  renderPassDescriptor: GPURenderPassDescriptor;

  f32UniformBuffer: GPUBuffer;
  u32UniformBuffer: GPUBuffer;
  gridDataBufferStorage: GPUBuffer;
  focusedIndicesStorage: GPUBuffer;
  selectedIndicesStorage: GPUBuffer;

  bodyPipeline: GPURenderPipeline;
  leftHeaderPipeline: GPURenderPipeline;
  topHeaderPipeline: GPURenderPipeline;
  verticesBuffer: GPUBuffer;

  numColumnsToShow: number;
  numRowsToShow: number;

  constructor(
    device: GPUDevice,
    view: GPUTextureView,
    canvasFormat: GPUTextureFormat,
    canvasElementContext: CanvasElementContextValue,
    gridContext: GridContextProps
  ) {
    this.canvasElementContext = canvasElementContext;
    this.canvasFormat = canvasFormat;
    const cellShaderModule = device.createShaderModule({
      label: 'Cell shader',
      code: cellShaderCode,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      label: 'bindGroupLayout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'uniform',
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'uniform',
          },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'read-only-storage',
          },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'read-only-storage',
          },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'read-only-storage',
          },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      label: 'Cell renderer pipeline layout',
      bindGroupLayouts: [bindGroupLayout],
    });

    this.renderPassDescriptor = {
      colorAttachments: [
        {
          view,
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    this.device = device;
    this.bindGroupLayout = bindGroupLayout;

    const createPipeline = (
      label: string,
      pipelineLayout: GPUPipelineLayout,
      cellShaderModule: GPUShaderModule,
      canvasFormat: GPUTextureFormat,
      vertexEntryPoint: string,
      fragmentEntryPoint: string
    ) => {
      return this.device.createRenderPipeline({
        label,
        layout: pipelineLayout,
        vertex: {
          module: cellShaderModule,
          entryPoint: vertexEntryPoint,
          buffers: [
            {
              arrayStride: 8,
              attributes: [
                {
                  format: 'float32x2',
                  offset: 0,
                  shaderLocation: 0,
                },
              ],
            },
          ],
        },
        fragment: {
          module: cellShaderModule,
          entryPoint: fragmentEntryPoint,
          targets: [
            {
              format: canvasFormat,
            },
          ],
        },
      });
    };

    this.bodyPipeline = createPipeline(
      'body',
      pipelineLayout,
      cellShaderModule,
      canvasFormat,
      'vertexBody',
      'fragmentBody'
    );
    this.leftHeaderPipeline = createPipeline(
      'leftHeader',
      pipelineLayout,
      cellShaderModule,
      canvasFormat,
      'vertexLeftHeader',
      'fragmentLeftHeader'
    );
    this.topHeaderPipeline = createPipeline(
      'topHeader',
      pipelineLayout,
      cellShaderModule,
      canvasFormat,
      'vertexTopHeader',
      'fragmentTopHeader'
    );

    this.numColumnsToShow = 0;
    this.numRowsToShow = 0;

    this.verticesBuffer = createVertexBuffer(
      'Vertices',
      device,
      gridCellVertices.length * 4
    );
    updateBuffer(
      this.device,
      this.verticesBuffer,
      new Float32Array(gridCellVertices)
    );

    this.f32UniformBuffer = createUniformBuffer('F32Uniforms', device, 14 * 4);
    this.u32UniformBuffer = createUniformBuffer('U32Uniforms', device, 4 * 4);

    const numCells =
      Math.max(gridContext.gridSize.numColumns, gridContext.gridSize.numRows) *
      4;
    this.focusedIndicesStorage = createStorageBuffer(
      'FocusedIndexBuffer',
      device,
      numCells
    );
    this.selectedIndicesStorage = createStorageBuffer(
      'SelectedIndexBuffer',
      device,
      numCells
    );
    this.gridDataBufferStorage = createStorageBuffer(
      'GridDataBuffer',
      device,
      gridContext.gridSize.numColumns * gridContext.gridSize.numRows * 4
    );
  }

  setF32UniformBuffer(
    gridContext: GridContextProps,
    viewport: {
      left: number;
      top: number;
      right: number;
      bottom: number;
    },
    numColumnsToShow: number,
    numRowsToShow: number
  ) {
    updateBuffer(
      this.device,
      this.f32UniformBuffer,
      createF32UniformBufferSource(
        this.canvasElementContext,
        gridContext,
        viewport,
        numColumnsToShow,
        numRowsToShow
      )
    );
    this.numColumnsToShow = numColumnsToShow;
    this.numRowsToShow = numRowsToShow;
    this.bindGroup = undefined;
  }

  setU32UniformBuffer(
    gridContext: GridContextProps,
    numColumnsToShow: number,
    numRowsToShow: number
  ) {
    updateBuffer(
      this.device,
      this.u32UniformBuffer,
      createUint32BufferSource(gridContext, numColumnsToShow, numRowsToShow)
    );
    this.numColumnsToShow = numColumnsToShow;
    this.numRowsToShow = numRowsToShow;
    this.bindGroup = undefined;
  }

  setDataBufferStorage(data: Float32Array) {
    updateBuffer(this.device, this.gridDataBufferStorage, data);
    this.bindGroup = undefined;
  }

  setFocusedIndicesStorage(focusedIndices: number[]) {
    updateBuffer(
      this.device,
      this.focusedIndicesStorage,
      new Uint32Array(focusedIndices)
    );
    this.bindGroup = undefined;
  }

  setSelectedIndicesStorage(selectedIndices: number[]) {
    updateBuffer(
      this.device,
      this.selectedIndicesStorage,
      new Uint32Array(selectedIndices)
    );
    this.bindGroup = undefined;
  }

  createBindGroup() {
    if (
      !this.f32UniformBuffer ||
      !this.u32UniformBuffer ||
      !this.focusedIndicesStorage ||
      !this.selectedIndicesStorage ||
      !this.gridDataBufferStorage
    ) {
      throw new Error();
    }
    return this.device.createBindGroup({
      label: 'Cell renderer bind group',
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.f32UniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.u32UniformBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.focusedIndicesStorage },
        },
        {
          binding: 3,
          resource: { buffer: this.selectedIndicesStorage },
        },
        {
          binding: 4,
          resource: { buffer: this.gridDataBufferStorage },
        },
      ],
    });
  }

  getUpdatedBindGroup() {
    if (this.bindGroup) {
      return this.bindGroup;
    } else {
      return (this.bindGroup = this.createBindGroup());
    }
  }

  createRenderBundle(
    label: string,
    pipeline: GPURenderPipeline,
    bindGroup: GPUBindGroup,
    numVertices: number,
    numInstances: number
  ) {
    const encoder = this.device.createRenderBundleEncoder({
      label,
      colorFormats: [this.canvasFormat],
    });
    encoder.setPipeline(pipeline);
    encoder.setVertexBuffer(0, this.verticesBuffer);
    encoder.setBindGroup(0, bindGroup);
    encoder.draw(numVertices, numInstances);
    return encoder.finish();
  }

  createBodyRenderBundle() {
    return this.createRenderBundle(
      'body',
      this.bodyPipeline,
      this.getUpdatedBindGroup(),
      gridCellVertices.length / 2,
      this.numColumnsToShow * this.numRowsToShow
    );
  }

  createTopHeaderRenderBundle() {
    return this.createRenderBundle(
      'topHeader',
      this.topHeaderPipeline,
      this.getUpdatedBindGroup(),
      gridCellVertices.length / 2,
      this.numColumnsToShow
    );
  }

  createLeftHeaderRenderBundle() {
    return this.createRenderBundle(
      'leftHeader',
      this.leftHeaderPipeline,
      this.getUpdatedBindGroup(),
      gridCellVertices.length / 2,
      this.numRowsToShow
    );
  }

  executeRenderBundles(renderBundles: GPURenderBundle[]) {
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(
      this.renderPassDescriptor
    );
    passEncoder.executeBundles(renderBundles);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
    console.log('[WebGPURenderBundleBuilder.executeRenderBundles] done');
  }
}
