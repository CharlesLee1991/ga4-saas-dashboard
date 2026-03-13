'use client'
// @ts-nocheck — d3-sankey의 복잡한 제네릭 타입 생략
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'

interface PathData {
  source_trace: string
  sessions: number
  order_count: number
  order_amount: number | null
}

interface SankeyChartProps {
  paths: PathData[]
  height?: number
}

const COLORS = ['#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#38bdf8', '#4ade80']

export default function SankeyChart({ paths, height = 360 }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !paths.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth || 900
    const margin = { top: 16, right: 160, bottom: 16, left: 16 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    // Build nodes and links from path data
    const nodeMap = new Map<string, number>()
    const links: { source: number; target: number; value: number }[] = []

    // Parse paths into step sequences
    for (const p of paths) {
      const steps = (p.source_trace || '').split(' > ')
      if (steps.length < 1) continue

      for (let i = 0; i < steps.length; i++) {
        const key = `Step${i}:${steps[i]}`
        if (!nodeMap.has(key)) nodeMap.set(key, nodeMap.size)
      }

      for (let i = 0; i < steps.length - 1; i++) {
        const srcKey = `Step${i}:${steps[i]}`
        const tgtKey = `Step${i + 1}:${steps[i + 1]}`
        const srcIdx = nodeMap.get(srcKey)!
        const tgtIdx = nodeMap.get(tgtKey)!

        const existing = links.find(l => l.source === srcIdx && l.target === tgtIdx)
        if (existing) {
          existing.value += p.sessions
        } else {
          links.push({ source: srcIdx, target: tgtIdx, value: p.sessions })
        }
      }
    }

    if (nodeMap.size === 0 || links.length === 0) return

    const nodes = Array.from(nodeMap.entries()).map(([key]) => ({
      name: key,
      label: key.split(':')[1] || key,
      step: parseInt(key.split(':')[0].replace('Step', '')) || 0,
    }))

    // Color by source name
    const sourceNames = Array.from(new Set(nodes.map(n => n.label)))
    const colorScale = (name: string) => COLORS[sourceNames.indexOf(name) % COLORS.length]

    // Sankey layout
    const sankeyGen = sankey()
      .nodeId((d: any) => (d as any).index ?? 0)
      .nodeWidth(20)
      .nodePadding(12)
      .extent([[margin.left, margin.top], [margin.left + innerW, margin.top + innerH]])
      .nodeSort(null)

    const graph = sankeyGen({
      nodes: nodes.map(n => ({ ...n } as any)),
      links: links.map(l => ({ ...l } as any)),
    } as any)

    const g = svg.append('g')

    // Links
    g.append('g')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('fill', 'none')
      .attr('stroke', (d: any) => {
        const src = graph.nodes[typeof d.source === 'number' ? d.source : (d.source as any).index]
        return colorScale((src as any).label)
      })
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', (d: any) => Math.max(2, d.width || 1))
      .on('mouseover', function () { d3.select(this).attr('stroke-opacity', 0.6) })
      .on('mouseout', function () { d3.select(this).attr('stroke-opacity', 0.35) })

    // Nodes
    g.append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => Math.max(4, d.y1 - d.y0))
      .attr('fill', (d: any) => colorScale(d.label))
      .attr('rx', 3)

    // Node labels
    g.append('g')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('x', (d: any) => d.x1 + 8)
      .attr('y', (d: any) => (d.y0 + d.y1) / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('font-family', 'Pretendard, sans-serif')
      .attr('fill', '#374151')
      .text((d: any) => {
        const label = d.label as string
        return label.length > 20 ? label.slice(0, 20) + '…' : label
      })

    // Step headers
    const maxStep = Math.max(...nodes.map(n => n.step))
    for (let s = 0; s <= maxStep; s++) {
      const nodesAtStep = graph.nodes.filter((n: any) => n.step === s)
      if (nodesAtStep.length === 0) continue
      const x = (nodesAtStep[0] as any).x0 + 10
      svg.append('text')
        .attr('x', x)
        .attr('y', 10)
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('fill', '#9ca3af')
        .attr('text-anchor', 'middle')
        .attr('letter-spacing', '1px')
        .text(s === 0 ? 'FIRST TOUCH' : s === maxStep ? 'LAST TOUCH' : `MID ${s}`)
    }

  }, [paths, height])

  if (!paths.length) return <div style={{ textAlign: 'center', padding: '40px', color: '#a0aec0' }}>경로 데이터 없음</div>

  return <svg ref={svgRef} width="100%" height={height} style={{ overflow: 'visible' }} />
}
