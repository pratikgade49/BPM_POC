export function isLaneGroup(elementRegistryItem) {
  const bo = elementRegistryItem?.businessObject
  const type = elementRegistryItem?.type || bo?.$type || ''
  // Lanes are of type "bpmn:Lane" in moddle, but elementRegistry type varies by renderer.
  // We best-effort match by checking businessObject.$type.
  return bo?.$type === 'bpmn:Lane' || type === 'bpmn:Lane'
}

export function getBusinessTypeKey(elementRegistryItem) {
  const bo = elementRegistryItem?.businessObject
  const type = elementRegistryItem?.type || bo?.$type || ''
  return type
}

