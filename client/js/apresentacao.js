// As telas são capturas locais do produto, sem sessão ou serviço externo.
const telas = {
  resumo: {
    alt: "Resumo operacional do Dispatch com indicadores e movimentações",
    legenda:
      "Clareza para acompanhar a operação. Tela demonstrativa com dados fictícios.",
  },
  colaboradores: {
    alt: "Colaboradores no Dispatch, com filtros, situação da CNH e histórico",
    legenda:
      "Pessoas e informações conectadas. Tela demonstrativa com dados fictícios.",
  },
  configuracoes: {
    alt: "Configurações e preferências do Dispatch",
    legenda:
      "Uma base organizada para sua operação. Tela demonstrativa com dados fictícios.",
  },
};
const abas = Array.from(document.querySelectorAll('[role="tab"]'));
const imagem = document.getElementById("tela-dispatch");
function ativarAba(aba) {
  const chave = aba.dataset.tela;
  abas.forEach((item) => {
    item.setAttribute("aria-selected", String(item === aba));
    item.tabIndex = item === aba ? 0 : -1;
  });
  imagem.src = "assets/apresentacao/" + chave + ".png";
  imagem.alt = telas[chave].alt;
  document.getElementById("legenda-tela").textContent = telas[chave].legenda;
  document
    .getElementById("painel-tela")
    .setAttribute("aria-labelledby", aba.id);
}
abas.forEach((aba, indice) => {
  aba.addEventListener("click", () => ativarAba(aba));
  aba.addEventListener("keydown", (evento) => {
    let destino;
    if (evento.key === "ArrowRight") destino = (indice + 1) % abas.length;
    if (evento.key === "ArrowLeft")
      destino = (indice - 1 + abas.length) % abas.length;
    if (evento.key === "Home") destino = 0;
    if (evento.key === "End") destino = abas.length - 1;
    if (destino === undefined) return;
    evento.preventDefault();
    abas[destino].focus();
    ativarAba(abas[destino]);
  });
});

// Parallax limitado a camadas decorativas. Um único frame por evento de rolagem;
// calcula somente elementos próximos da viewport e respeita movimento reduzido.
const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
const camadas = Array.from(
  document.querySelectorAll("[data-parallax]"),
  (elemento) => ({ elemento, deslocamento: 0 }),
);
let framePendente = false;
function desenharParallax() {
  framePendente = false;
  const altura = window.innerHeight;
  const intensidade = window.innerWidth <= 760 ? 0.35 : 1;
  camadas.forEach((camada) => {
    if (movimentoReduzido.matches) {
      camada.elemento.style.removeProperty("transform");
      camada.deslocamento = 0;
      return;
    }
    const rect = camada.elemento.getBoundingClientRect();
    const topoOriginal = rect.top - camada.deslocamento;
    if (
      topoOriginal > altura * 1.5 ||
      topoOriginal + rect.height < -altura * 0.5
    )
      return;
    const distancia = altura / 2 - (topoOriginal + rect.height / 2);
    camada.deslocamento = Math.max(
      -80,
      Math.min(
        80,
        distancia * Number(camada.elemento.dataset.parallax) * intensidade,
      ),
    );
    camada.elemento.style.transform = `translate3d(0, ${camada.deslocamento.toFixed(2)}px, 0)`;
  });
}
function agendarParallax() {
  if (framePendente) return;
  framePendente = true;
  window.requestAnimationFrame(desenharParallax);
}
window.addEventListener("scroll", agendarParallax, { passive: true });
window.addEventListener("resize", agendarParallax);
movimentoReduzido.addEventListener("change", agendarParallax);
agendarParallax();

// Planos de apresentação: detalhe do escopo, sem simular cobrança ou contratação.
const planos = {
  essencial: {
    nome: "Essencial",
    descricao:
      "Um ponto de partida para organizar os principais registros da operação.",
    recursos: [
      "Cadastro de colaboradores",
      "Alojamentos, quartos, leitos e estadias",
      "Frota e movimentações",
      "Resumo operacional",
    ],
  },
  profissional: {
    nome: "Profissional",
    descricao:
      "Uma proposta para ampliar a análise e a rastreabilidade da operação.",
    recursos: [
      "Escopo do Essencial",
      "Relatórios de ocupação e frota",
      "Histórico e auditoria com hashes encadeados",
      "Central de notificações",
    ],
  },
  "sob-medida": {
    nome: "Sob medida",
    descricao:
      "Um convite para mapear necessidades e avaliar possibilidades. Novos recursos e integrações dependem de análise de viabilidade.",
    recursos: [
      "Levantamento de necessidades",
      "Definição conjunta de escopo",
      "Análise de integrações",
      "Planejamento de implantação",
    ],
  },
};
const dialogo = document.getElementById("dialogo-plano");
document.querySelectorAll("[data-plano]").forEach((botao) => {
  botao.addEventListener("click", () => {
    const plano = planos[botao.dataset.plano];
    document.getElementById("dialogo-titulo").textContent = plano.nome;
    document.getElementById("dialogo-descricao").textContent = plano.descricao;
    document.getElementById("dialogo-recursos").replaceChildren(
      ...plano.recursos.map((texto) => {
        const item = document.createElement("li");
        item.textContent = texto;
        return item;
      }),
    );
    dialogo.showModal();
    document.body.classList.add("dialogo-aberto");
  });
});
dialogo
  .querySelector(".dialogo-fechar")
  .addEventListener("click", () => dialogo.close());
dialogo.addEventListener("click", (evento) => {
  const rect = dialogo.getBoundingClientRect();
  if (
    evento.target === dialogo &&
    (evento.clientX < rect.left ||
      evento.clientX > rect.right ||
      evento.clientY < rect.top ||
      evento.clientY > rect.bottom)
  )
    dialogo.close();
});
dialogo.addEventListener("close", () =>
  document.body.classList.remove("dialogo-aberto"),
);
