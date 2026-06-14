export function disposeObject3D(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse?.(object => {
    if (object.geometry) geometries.add(object.geometry);
    collectMaterials(object.material, materials, textures);
  });

  for (const geometry of geometries) geometry.dispose?.();
  for (const texture of textures) texture.dispose?.();
  for (const material of materials) material.dispose?.();
}

function collectMaterials(material, materials, textures) {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const entry of material) collectMaterials(entry, materials, textures);
    return;
  }
  materials.add(material);
  for (const value of Object.values(material)) {
    if (value?.isTexture) textures.add(value);
  }
}
