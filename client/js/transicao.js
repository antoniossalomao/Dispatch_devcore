// A troca entre páginas (login -> sistema -> sair) tem uma animação do próprio navegador.
// Quando ela é cancelada (aba escondida, página já mostrada), o navegador joga um erro no console,
// mas a página abre normal. Aqui a gente só avisa que já sabe disso, pra o console ficar limpo.
// Fica num arquivo carregado no <head> porque esses eventos acontecem antes do resto da página.
function ignorarTransicaoCancelada(evento) {
  if (evento.viewTransition) {
    evento.viewTransition.ready.catch(function () {});
    evento.viewTransition.finished.catch(function () {});
    evento.viewTransition.updateCallbackDone.catch(function () {});
  }
}

window.addEventListener('pagereveal', ignorarTransicaoCancelada);
window.addEventListener('pageswap', ignorarTransicaoCancelada);
