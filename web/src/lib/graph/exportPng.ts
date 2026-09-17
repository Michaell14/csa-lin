import type { Lin, LinGraph } from '@/lib/types'
import { layoutLin, NODE_H, NODE_W } from '@/lib/graph/layout'
import { yearColor } from '@/lib/graph/colors'
import { buildFlowElements, portFraction } from '@/lib/graph/flow'

const PAD = 80, HEADER = 100, MAX_SIDE = 12000, SCALE = 2, MAX_CANVAS_PIXELS = 64_000_000

export function exportDimensions(graph: LinGraph) {
  const layout = layoutLin(graph)
  const width = Math.ceil(Math.max(900, ...layout.nodes.map(node => node.x + NODE_W + PAD)))
  const height = Math.ceil(Math.max(500, ...layout.nodes.map(node => node.y + NODE_H + PAD)) + HEADER)
  if (width > MAX_SIDE || height > MAX_SIDE || width * SCALE * height * SCALE > MAX_CANVAS_PIXELS) throw new Error('This lin is too large for one image. Try exporting a smaller family path.')
  return { layout, width, height }
}

export async function downloadLinPng(lin: Lin, graph: LinGraph): Promise<void> {
  const { layout, width, height } = exportDimensions(graph)
  const canvas = document.createElement('canvas'); canvas.width = width * SCALE; canvas.height = height * SCALE
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Your browser could not create the image.')
  ctx.scale(SCALE, SCALE); ctx.fillStyle = '#faf7f2'; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#26211c'; ctx.font = 'bold 28px Georgia, serif'; ctx.fillText(lin.name, 40, 42)
  ctx.fillStyle = '#837a70'; ctx.font = '14px system-ui'; ctx.fillText(`${graph.people.length} members · Exported ${new Date().toLocaleDateString()}`, 40, 68)
  const positions = new Map(layout.nodes.map(node => [node.id, node]))
  const flowNodes = new Map(buildFlowElements(graph, layout, { selectedId: null, photoUrls: new Map() }).nodes.map(node => [node.id, node]))
  ctx.strokeStyle = '#b3a99d'; ctx.lineWidth = 2
  for (const link of graph.links) {
    const a = positions.get(link.big_id), b = positions.get(link.little_id)
    const source = flowNodes.get(link.big_id)?.data.sourcePorts, target = flowNodes.get(link.little_id)?.data.targetPorts
    if (!a || !b || !source || !target) continue
    ctx.beginPath()
    ctx.moveTo(a.x + NODE_W * portFraction(source.indexOf(link.id), source.length), a.y + HEADER + NODE_H)
    ctx.lineTo(b.x + NODE_W * portFraction(target.indexOf(link.id), target.length), b.y + HEADER)
    ctx.stroke()
  }
  for (const person of graph.people) {
    const p = positions.get(person.id); if (!p) continue; const x = p.x, y = p.y + HEADER
    ctx.fillStyle = '#fff'; ctx.strokeStyle = yearColor(person.grad_year); ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, NODE_W, NODE_H, NODE_H / 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#26211c'; ctx.font = '14px system-ui'; const name = person.placeholder ? 'Founder' : person.display_name ?? 'Unnamed'; ctx.fillText(name.length > 20 ? `${name.slice(0, 19)}…` : name, x + 14, y + 25)
    ctx.fillStyle = '#837a70'; ctx.font = '12px system-ui'; ctx.fillText(`’${String(person.grad_year).slice(-2)}`, x + NODE_W - 32, y + 25)
  }
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The image could not be encoded.')
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `${lin.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-family-tree.png`; anchor.click(); URL.revokeObjectURL(url)
}
