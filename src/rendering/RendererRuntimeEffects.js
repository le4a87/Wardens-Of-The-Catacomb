import { RendererRuntimeScene } from "./RendererRuntimeScene.js";
import { rendererEffectsPlayerMethods } from "./rendererEffectsPlayerMethods.js";
import { rendererEffectsProjectileMethods } from "./rendererEffectsProjectileMethods.js";

export class RendererRuntimeEffects extends RendererRuntimeScene {}

Object.assign(RendererRuntimeEffects.prototype, rendererEffectsPlayerMethods, rendererEffectsProjectileMethods);
