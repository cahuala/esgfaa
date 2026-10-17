import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

// cores do pessoal (verde militar, dourado, azul-marinho, azul-céu…)
const CORES = ['#2d5a3d', '#c9a227', '#1f3b73', '#4a90c2', '#8c3b2e', '#6b8e23', '#7b5ea7', '#d17a22', '#3a7d7c', '#a33b5c', '#5b6770', '#b5a642', '#2e86ab', '#9c6644', '#4f772d']

/*
  Gráfico Chart.js clicável: aoClicar(indice, serie) recebe a barra/fatia em que se clicou
  (o painel usa-o para abrir a lista filtrada). tipo: bar | barH | doughnut | pie | line | polarArea.
*/
export default function Grafico({ tipo = 'bar', rotulos, series, aoClicar, altura = 260, empilhado = false, legenda }) {
  const tela = useRef(null)
  const grafico = useRef(null)
  const clique = useRef(aoClicar)
  useEffect(() => { clique.current = aoClicar }, [aoClicar])

  useEffect(() => {
    const circular = ['doughnut', 'pie', 'polarArea'].includes(tipo)
    const horizontal = tipo === 'barH'
    const dados = {
      labels: rotulos,
      datasets: series.map((s, i) => ({
        label: s.rotulo,
        data: s.valores,
        backgroundColor: circular ? s.valores.map((_, j) => s.cores?.[j] ?? CORES[j % CORES.length]) : s.cor ?? CORES[i % CORES.length],
        borderColor: tipo === 'line' ? s.cor ?? CORES[i % CORES.length] : circular ? '#fff' : undefined,
        borderWidth: circular ? 2 : tipo === 'line' ? 2.5 : 0,
        borderRadius: circular || tipo === 'line' ? 0 : 4,
        tension: 0.3,
        cubicInterpolationMode: 'monotone',
        fill: false,
        pointRadius: tipo === 'line' ? 3.5 : undefined,
      })),
    }
    grafico.current = new Chart(tela.current, {
      type: horizontal ? 'bar' : tipo,
      data: dados,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        animation: { duration: 500 },
        plugins: {
          legend: { display: legenda ?? (circular || series.length > 1), position: circular ? 'right' : 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { footer: () => (clique.current ? 'Clique para ver a lista' : '') } },
        },
        scales: circular ? {} : {
          x: { stacked: empilhado, grid: { display: horizontal }, ticks: { font: { size: 11 }, precision: 0 } },
          y: { stacked: empilhado, beginAtZero: true, grid: { display: !horizontal }, ticks: { font: { size: 11 }, precision: 0 } },
        },
        onHover: (e, el) => { e.native.target.style.cursor = el.length && clique.current ? 'pointer' : 'default' },
        onClick: (e, el) => { if (el.length && clique.current) clique.current(el[0].index, el[0].datasetIndex) },
      },
    })
    return () => grafico.current?.destroy()
  }, [tipo, rotulos, series, empilhado, legenda])

  return <div style={{ position: 'relative', height: altura }}><canvas ref={tela} role="img" aria-label={series.map((s) => s.rotulo).join(', ')} /></div>
}
