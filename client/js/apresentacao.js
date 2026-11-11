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

// Cenas ligadas à rolagem nativa, sem capturar wheel/touch nem adicionar dependências.
// Lê a geometria antes das escritas; interpola apenas enquanto há movimento pendente.
const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
const ponteiroPreciso = window.matchMedia("(hover: hover) and (pointer: fine)");
const hero = document.querySelector(".hero");
const produto = document.querySelector(".produto-cena");
const manifesto = document.querySelector(".manifesto");
const convite = document.querySelector(".convite");
const estadoMovimento = {
  hero: 0,
  produto: 0,
  manifesto: 0,
  convite: 0,
  x: 0,
  y: 0,
};
const mouseAlvo = { x: 0, y: 0 };
let frameMovimento = null;
const limitar = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
function progressoCena(elemento, margem) {
  const rect = elemento.getBoundingClientRect();
  const curso = Math.max(1, rect.height - (window.innerHeight - margem));
  return limitar((margem - rect.top) / curso);
}
function passagem(elemento) {
  const rect = elemento.getBoundingClientRect();
  return (
    limitar(
      (window.innerHeight - rect.top) / (window.innerHeight + rect.height),
    ) *
      2 -
    1
  );
}
function animarCenas() {
  frameMovimento = null;
  if (movimentoReduzido.matches || document.hidden) return;
  const desktopPreso = window.innerWidth > 1000 && window.innerHeight >= 700;
  const alvos = {
    hero: desktopPreso
      ? progressoCena(hero, 88)
      : limitar(-hero.getBoundingClientRect().top / hero.offsetHeight),
    produto: progressoCena(produto, window.innerWidth <= 760 ? 145 : 105),
    manifesto: passagem(manifesto),
    convite: passagem(convite),
    x: mouseAlvo.x,
    y: mouseAlvo.y,
  };
  let continuar = false;
  Object.keys(alvos).forEach((chave) => {
    const diferenca = alvos[chave] - estadoMovimento[chave];
    estadoMovimento[chave] =
      Math.abs(diferenca) < 0.0005
        ? alvos[chave]
        : estadoMovimento[chave] + diferenca * 0.14;
    if (Math.abs(diferenca) >= 0.0005) continuar = true;
  });
  // As variáveis ficam no escopo de cada cena para limitar o recálculo de estilos.
  hero.style.setProperty("--hero-p", estadoMovimento.hero.toFixed(4));
  hero.style.setProperty("--mouse-x", estadoMovimento.x.toFixed(4));
  hero.style.setProperty("--mouse-y", estadoMovimento.y.toFixed(4));
  produto.style.setProperty("--produto-p", estadoMovimento.produto.toFixed(4));
  manifesto.style.setProperty(
    "--manifesto-p",
    estadoMovimento.manifesto.toFixed(4),
  );
  convite.style.setProperty("--convite-p", estadoMovimento.convite.toFixed(4));
  if (continuar) frameMovimento = requestAnimationFrame(animarCenas);
}
function agendarMovimento() {
  if (frameMovimento === null && !movimentoReduzido.matches && !document.hidden)
    frameMovimento = requestAnimationFrame(animarCenas);
}
function configurarMovimento() {
  if (frameMovimento !== null) cancelAnimationFrame(frameMovimento);
  frameMovimento = null;
  document.body.classList.toggle("movimento-ativo", !movimentoReduzido.matches);
  if (movimentoReduzido.matches) {
    [hero, produto, manifesto, convite].forEach((elemento) => {
      [
        "--hero-p",
        "--mouse-x",
        "--mouse-y",
        "--produto-p",
        "--manifesto-p",
        "--convite-p",
      ].forEach((nome) => elemento.style.removeProperty(nome));
    });
    Object.keys(estadoMovimento).forEach(
      (chave) => (estadoMovimento[chave] = 0),
    );
    return;
  }
  agendarMovimento();
}
hero.addEventListener("pointermove", (evento) => {
  if (!ponteiroPreciso.matches || movimentoReduzido.matches) return;
  const rect = hero.querySelector(".hero-conteudo").getBoundingClientRect();
  mouseAlvo.x = limitar(
    ((evento.clientX - rect.left) / rect.width) * 2 - 1,
    -1,
    1,
  );
  mouseAlvo.y = limitar(
    ((evento.clientY - rect.top) / rect.height) * 2 - 1,
    -1,
    1,
  );
  agendarMovimento();
});
hero.addEventListener("pointerleave", () => {
  mouseAlvo.x = 0;
  mouseAlvo.y = 0;
  agendarMovimento();
});
window.addEventListener("scroll", agendarMovimento, { passive: true });
window.addEventListener("resize", agendarMovimento);
document.addEventListener("visibilitychange", agendarMovimento);
window.addEventListener("pageshow", agendarMovimento);
movimentoReduzido.addEventListener("change", configurarMovimento);
configurarMovimento();

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
