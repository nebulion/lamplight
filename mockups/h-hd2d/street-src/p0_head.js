/* The street (2026-10-27): mockup H's HD-2D canal (Octopath Traveler's look: pixel art on real geometry),
 * made endless and tied to the applications he sends.
 *
 *   one loop of five blocks (~290 m) that repeats as the camera drifts along it on its own (like a screensaver);
 *   about 550 lights: streetlamps, bridge bulbs, and every window, shop window, fanlight and lantern;
 *   each light is dark until an application lights it (setLit), in a fixed order: lamps, bulbs, then windows;
 *   iconic buildings: the House with the Heads, warehouses, Golden Bend mansions, a 2 m house, Damrak's leaning
 *   houses, the Skinny Bridge, houseboats; behind: the next canal's rooftops and four church towers.
 *
 * Used by the tracker (scene3d.js) and by mockups/h-hd2d/street.html. Units are metres. Houses face +z.
 * Street z 0..9, canal z 9.4..19, near quay z 19..25. Everything is generated from a fixed seed.
 */
import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

if (!document.createElement("canvas").getContext("webgl2")) throw new Error("no webgl2");
