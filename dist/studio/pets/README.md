# Pet Cutout Studio

Open `index.html` through the Studio server, or choose **Thú cưng cutout** from
the main Studio menu. Mobile starts on Preview; ☰ switches tools without a long
document scroll. **← Nhân vật** returns to the character editor without resetting
either project. Pet drafts use their own `nightcamp.pet.cutout.v1` storage key.

## Build a new species from scratch

Choose **Tạo pet trống** under **Chọn pet & chuyển động**. It creates just one
empty root and one neutral idle key: no preset images, skeleton or motion is copied.
The always-visible **Chế độ** selector separates two workflows:

- **Dựng rig** shows the neutral rest skeleton. Add child or independent root
  bones, rename labels/IDs, delete one bone or a whole branch, assign uploaded
  PNG/WebP or existing images, edit rest rotation/size/attachment and front/back
  layer order. Changes apply to the skeleton shared by all animations.
- **Animation** locks structural controls. Dragging or editing pose channels only
  changes the current pose; **Ghi pose** commits it to a frame. Entering Rig does
  not bake the displayed animation pose into the rest skeleton.

In Rig, **Thêm xương tại chỗ chạm** adds a child of the selected bone at the
clicked position. **Nối xương đang chọn → cha** links the selected child to a
clicked parent; a cycle is rejected. Detach with **Gốc / không có cha**.
Reparenting preserves world position/rotation/scale at rest, not the world-space
trajectory of every existing animation: changing hierarchy can require retuning clips.
**Đặt khớp trên ảnh · giữ ảnh** places/drags the pivot directly on the preview;
the picture and child joints stay fixed at rest. The image-anchor panel and pivot
number fields have the same behavior. **Dịch bộ phận / khớp** moves the piece and
its descendants. All these operations support Undo/Redo.

Renaming an ID migrates child links and pose channels in every saved clip. Deleting
one bone promotes its children, preserving rest placement; deleting a branch removes
its channels from all clips. Both retain the images in the project library. Keep at
least one root; use a blank project to start over. Limits: 100 bones, 300 images.
Images must be prepared as separate cutout pieces; uploading a flat illustration
does not automatically infer anatomy or generate hidden art. Mesh/weights are not added.

Saved projects, game bundles, standalone HTML previews and the downloadable runtime
include custom bone labels and additive rest `rotation` in radians. Use the newly
exported pet runtime when moving a custom rig to a game; older runtime versions do
not understand the new rest rotation. Existing preset projects remain compatible.

## Presets and animation

Seven presets: wolf, falcon, wyvern, lantern, axe/shield/crossbow battle puppets.
There are 29 baked clips, derived from the original `js/petrig.js` pose equations
with deterministic preview states. This is not a recovery of the full procedural
AI/spring simulation, combat, summons or online server. Only rigid cutout images
and parented transforms are edited; no Spine, weighted meshes or strip deformation
of the images. Parts rotate and translate as rigid pieces, so very large edits
can expose joins; adjust attachment/pivot/overlap by moving the pieces.

Preview dragging defaults to **Tạo pose · giữ khớp nối**: drag a hollow ring on
the paw/head/tail to rotate around its pinned attachment. Existing puppet elbows
and knees use two-segment rotational IK. Dragging a pivot uses a virtual lever;
translation requires **Dịch / tách bộ phận** in the always-visible drag selector.
In **Tư thế**, **Nối lại khớp** restores displaced offsets in the current pose from
the original preset (or a custom rig's saved idle), retaining angles and leaving
other frames untouched. Press **Ghi pose** to commit. Single-image legs remain
rigid cutouts, not newly split knee rigs or weighted meshes.

Select a bone on Preview, the part buttons, or the selectors in **Khớp & ảnh**
and **Tư thế**. Edit its parent, local attachment offset, image pivot (0–1), image
size, scale and draw order; add children or replace PNG/WebP images. Pose edits
need **Ghi pose**. New animations have one frame; appended frames inherit the
currently edited pose. Copy poses to multiple selected frames. The current clip
is stored in the pet's clip set when saved; **Lưu clip** can give it a new ID.

The original creature images remain the original authors' assets; source access
does not grant additional reuse rights.

## Export and use in another game

- `.pet-cutout.json`: validated project including every sprite as an embedded PNG.
- `.pet-game-bundle.json`: the same project plus standalone runtime source as text.
  The Studio import reads only `project`; never evaluates supplied runtime/code.
- `pet-runtime.mjs`: independent ES module, no Night Camp globals or dependencies.
- `.pet-preview.html`: single-file web preview with embedded images and runtime,
  a clip selector, playback toggle and flip. Can be opened offline.

```js
import { PetCutoutPlayer } from './pet-runtime.mjs';
const bundle = await fetch('./wolf.pet-game-bundle.json').then(r => r.json());
const pet = await PetCutoutPlayer.load(bundle.project);
pet.play('run'); // IDs are keys of project.clips
// In the game loop:
pet.update(deltaSeconds);
pet.draw(canvasContext, x, y, 3, { flip: false, bones: false });
```

`bones` retain parent IDs, local `at`, normalized image `pivot`, local scale and
layer order. Pose channels are `boneId:rot/dx/dy/sx/sy/img/hide`; rotations are in
radians. Image variants and visibility are discrete, not interpolated. Variant
image indices refer to `spriteOrder` (`-1` means the bone's default sprite).
An imported project's hierarchy is validated for cycles and missing parents.

Regenerate the bundled preset catalog with `node tools/build-pet-studio.mjs`.
Keep the source catalog, runtime and editor together when publishing a new version.
