# PortWatch Hub

Uma central de mesa para acompanhar a corrida **PortWatch VI** — os esforços da comunidade para rodar **GTA VI no PC**. O hub lê o tracker oficial ao vivo, ranqueia os projetos, baixa o código público de cada projeto e fork, e ainda verifica se o seu PC aguenta o alvo escolhido.

Feito por **Nicolas Garcia (Nico.SCI)**.

![Prévia do PortWatch Hub](docs/preview.png)

- Site da corrida: <https://portwatch-vi.xyz/#top>
- Tracker no GitHub: <https://github.com/4lwayz/portwatch-vi>

## Baixar pronto para usar

[![Baixar para Windows](https://img.shields.io/badge/baixar-Windows%20port%C3%A1til-ff6b9d?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/breelybr-pixel/portwatch-hub/releases/latest)

Baixe o ZIP na página de **[Releases](https://github.com/breelybr-pixel/portwatch-hub/releases/latest)**, extraia e abra **PortWatch Hub.exe**. Não precisa de Git nem Node.js. Requisitos: Windows 10/11 64-bit.

Se o Windows SmartScreen avisar que o app não tem assinatura, clique em **Mais informações → Executar assim mesmo**.

## O que ele faz

- **Corrida ao vivo:** busca `data/tracker.json` do repositório oficial e aplica o mesmo modelo de pontuação do site (Groundwork → Exe runs → First frame → Main menu → In the world → Playable → Complete, com as trilhas story/render/performance/stability).
- **Leaderboard completo:** projetos ranqueados, builds privadas, watchlist e projetos desativados, com filtros por alvo (GTA VI ou camadas gerais) e ordenação por progresso, estrelas ou atividade.
- **Downloads integrados:** lista todos os projetos públicos do tracker e todos os forks do PortWatch, com busca, progresso e extração automática do ZIP. Ao baixar uma fork, o launcher pergunta em qual pasta você quer salvar.
- **Jogar com DexNom:** prepara o runtime **DexNom** (fork do VIctory para AMD Radeon) e inicia o GTA VI com a sua cópia local do jogo, com botão **Jogar/Parar**, atalho **Executar** na tela inicial, pasta de instalação configurável, ray tracing opcional e log da preparação.
- **Hardware:** detecta CPU, GPU, VRAM, RAM e armazenamento, permite simular outras peças e compara o PC com alvos de 1080p a 4K.
- **Temas:** **Vice City** (padrão) e **Los Santos**, com cenário, cores e rádio próprios.
- **Trilíngue:** Português (Brasil), English e Español, com escolha na primeira abertura e troca imediata em Ajustes.
- **Rádio local:** estações synthwave geradas por WebAudio no próprio launcher, sem internet.
- **Cena com parallax:** céu, sol, skyline e reflexo na água reagindo ao mouse.
- **Atualização automática:** o tracker é recarregado no intervalo escolhido (1 a 60 minutos) e pode ser atualizado na hora com o botão ou a tecla `R`.

O hub **não** hospeda, baixa nem linka arquivos do jogo, chaves ou executáveis. Os downloads são apenas os ZIPs públicos dos repositórios do GitHub.

## Como abrir

**Primeira vez:** dê dois cliques em `INICIAR.cmd`. Ele confere o Node.js, instala as dependências automaticamente e abre o hub. Funciona em qualquer pasta — não há caminho fixo.

**No dia a dia:** dê dois cliques em `ABRIR-LAUNCHER.vbs` para abrir sem janela de console. Se as dependências ainda não estiverem instaladas, ele chama o `INICIAR.cmd` sozinho.

**Atalho na área de trabalho:** rode `CRIAR-ATALHO.cmd`. Ele cria um atalho `PortWatch Hub` com o ícone do app, apontando para a pasta atual. Se mover o projeto, rode o script de novo para atualizar o atalho.

**Pelo terminal:**

```powershell
cd "caminho\para\PortWatch Hub"
npm install   # só na primeira vez
npm start
```

Requisitos: Windows 10/11 e Node.js 22 ou mais recente (o npm vem junto).

**Só a interface, sem o app:** `npm run preview` e abra <http://localhost:4317>. O preview inclui proxies same-origin para o tracker e para a API de forks, então a corrida e a lista de downloads funcionam no navegador. Downloads de ZIP e abertura de pastas exigem o app desktop.

## Corrida

A corrida é montada a partir do tracker oficial:

| Grupo | O que mostra |
| --- | --- |
| Ranqueados | Projetos com repositório público, ordenados pela pontuação de 0 a 100. |
| Privados | Esforços sem repositório público, com a base declarada quando existe. |
| Watchlist | Projetos ainda em observação, sem entrar no ranking principal. |
| Desativados | Projetos marcados como encerrados ou removidos. |

Cada cartão mostra a pontuação, a fase alcançada, o alvo, a abordagem, as estrelas, a data do último push e o estado de verificação. Quando o projeto tem repositório público, o botão **Baixar** aparece ali mesmo.

A pontuação é recalculada no launcher com as mesmas regras do site: a escada de milestones vale os primeiros 50 pontos e, a partir de **Playable**, as quatro trilhas (story 35%, render 25%, performance 20%, estabilidade 20%) preenchem os outros 50.

## Downloads

A aba **Downloads** reúne duas fontes:

- **Projetos da corrida:** todos os esforços com repositório público no tracker.
- **Forks do PortWatch:** todos os forks de `4lwayz/portwatch-vi`, ordenados pelo push mais recente.

O ZIP é baixado do GitHub (codeload ou API) e extraído com `Expand-Archive` na pasta escolhida. Se o arquivo tiver uma única pasta raiz, o conteúdo é achatado para ficar direto na pasta do projeto.

A pasta padrão é `Downloads` dentro da pasta do launcher. Use **Escolher pasta** para trocar e **Abrir pasta** para abrir no Explorer. O progresso aparece na própria linha, com fases de download e extração.

Projetos grandes podem demorar. Se a API do GitHub limitar as requisições, preencha um **token do GitHub** em **Ajustes → Tracker** — ele é opcional e fica salvo apenas em `data\config.json`.

## Jogar (DexNom)

A aba **Jogar** integra o **DexNom Runtime**, fork do VIctory para placas AMD Radeon. O launcher **não baixa o jogo**: você aponta para o executável da sua própria cópia de GTA VI (Xbox Series X|S) e para a pasta da fork baixada na aba **Downloads**.

**Pré-requisitos para preparar o runtime**

- Windows 10/11 64-bit com driver Direct3D 12 atualizado.
- Rust (rustup + Cargo): <https://rustup.rs/>.
- Visual Studio Build Tools com a carga **Desenvolvimento para desktop com C++** e o **Windows SDK**. Se o Build Tools já estiver instalado em outro disco, o launcher detecta e usa essa instalação, inclusive quando o `vswhere` não a lista; se a detecção falhar, use **Localizar Build Tools**. Se faltar, o botão **Instalar Build Tools** baixa o instalador oficial da Microsoft, confere a assinatura digital, pede permissão de administrador (UAC) e instala a carga C++ com o Windows SDK. A instalação automática usa o C: e precisa de cerca de 6 GB livres no C:, mesmo que o runtime esteja em outro disco.
- Pelo menos 5 GB livres no disco da fork.
- GPU compatível com mesh shaders e Shader Model 6.6. O DexNom foi testado em Radeon RX 7900 XTX; placas mais antigas podem não rodar.

**Como usar**

1. Baixe a fork DexNom na aba **Downloads** (ou escolha a pasta de uma cópia já extraída).
2. Abra **Jogar** e confira se a fork e o executável do jogo foram detectados. Use **Escolher pasta** e **Escolher .exe** se precisar. A pasta de instalação padrão é `%LOCALAPPDATA%\DexNom Runtime`; use **Escolher pasta** na linha **Pasta de instalação** para instalar em outro disco ou pasta. Essa pasta é só do runtime: o Build Tools é detectado separadamente.
3. Clique em **Preparar / atualizar**. O launcher roda o `Setup-DexNomRuntime.ps1` da fork com a pasta escolhida, mostra o log ao vivo e instala o runtime nessa pasta. Se o Build Tools não for detectado, use **Localizar Build Tools** para apontar uma instalação existente ou **Instalar Build Tools** para baixar; o andamento aparece na própria aba e o log fica em `data\logs\msvc-install.log`.
4. Quando o runtime estiver pronto, clique em **Jogar**. O botão vira **Parar** enquanto o jogo estiver aberto. O ray tracing experimental pode ser ativado pelo interruptor `--rt`. Na tela inicial, **EXECUTAR** fica ao lado de **VER CORRIDA** e abre o jogo direto; se ainda faltar configuração, ele leva para esta aba.

O log da preparação fica em `data\logs\dexnom-setup.log`. A fork é código de terceiros: compilar e executar roda código no seu PC. Use apenas com uma cópia legal do jogo.

## Hardware

A aba **Hardware** detecta o PC atual pelo Windows e transforma cada componente em uma nota de 0 a 100. Depois compara essa nota com o alvo escolhido e mostra o veredito **Pronto para o alvo**, **Jogável com ajustes** ou **Abaixo do recomendado**.

| Alvo | GPU | CPU | RAM | Armazenamento |
| --- | --- | --- | --- | --- |
| 1080p Baixo · 30–60 FPS | 45 | 45 | 50 | 50 |
| 1080p Alto · 60 FPS | 65 | 63 | 65 | 65 |
| 1440p Alto · 60 FPS | 78 | 72 | 76 | 72 |
| 4K Ultra · 60+ FPS | 90 | 82 | 85 | 82 |

A detecção lê o nome da GPU, a VRAM, o modelo e os núcleos da CPU, a quantidade/tipo/velocidade da RAM e o tipo do disco de downloads. Use **Atualizar detecção** para reler o PC. Os selects de peças ficam sempre disponíveis: ao mudar qualquer componente, o modo manual liga sozinho; o interruptor **Usar hardware detectado** volta para a detecção real. As notas são estimativas inspiradas em dados da comunidade; não medem o desempenho real de cada port.

## Temas

- **Vice City** (padrão): anoitecer neon em Leonida, sol listrado, palmeiras e oceano.
- **Los Santos**: sol de San Andreas, colinas, cidade e pier ao entardecer.

A troca é imediata em **Ajustes → Aparência** e muda o cenário, as cores dos menus, os destaques e até os nomes das estações de rádio. A preferência fica salva.

## Atalhos

| Tecla | Ação |
| --- | --- |
| `Enter` | Abre a corrida (fora de menus) |
| `R` | Atualiza o tracker e os forks |
| `Esc` | Fecha menus, diálogos e a folha |
| `F11` | Alterna tela cheia |

A rádio fica no canto direito do dock e começa tocando. Clique no nome ou na seta para abrir a lista de estações; clique no botão redondo para pausar ou continuar. A estação e o estado ficam salvos.

## Ajustes úteis

- **Aparência:** alterna Vice City e Los Santos.
- **Idioma:** aplica na hora e vale para o launcher, avisos e mensagens de erro.
- **Sons da interface:** cliques e passagem do mouse.
- **Música de fundo:** começa junto com o launcher e pode ser pausada no dock ou em Ajustes.
- **Reduzir movimento:** desliga parallax e animações longas.
- **Abrir em tela cheia:** aplica ao iniciar o launcher.
- **Volume da rádio:** volume das estações.
- **Atualizar a cada:** intervalo de recarga automática do tracker.
- **Token do GitHub:** aumenta o limite da API ao listar forks e baixar projetos.
- **Pasta de downloads:** onde os ZIPs são extraídos.
- **Restaurar padrões:** volta às preferências originais, preservando o idioma e a estação de rádio.

As preferências ficam em `data\config.json`.

## Estrutura

```
PortWatch Hub/
  INICIAR.cmd        inicializador: confere o Node, instala dependências e abre
  CRIAR-ATALHO.cmd   cria o atalho na área de trabalho
  ABRIR-LAUNCHER.vbs abre sem janela de console
  main.js            processo principal (janela, IPC, tracker, forks, downloads, DexNom)
  hardware-main.js   detecção de hardware isolada
  preload.js         ponte segura para o renderer (window.portwatch)
  preview.js         servidor de preview com proxies do tracker e forks
  app/
    index.html       marcação da interface
    styles.css       cena, vidro, tipografia e animações
    portwatch.css    identidade PortWatch, corrida, downloads, DexNom e tema Los Santos
    app.js           estado, corrida, downloads, DexNom, ajustes, idioma e navegação
    radio.js         sintetizador das estações
    hardware.js      interface e cálculo do verificador de hardware
    scene.js         estrelas, skyline, parallax e relógio
    i18n.js          textos em português, inglês e espanhol
    assets/          ícone e silhueta da palmeira
    fonts/           Anton, Yellowtail e Inter locais
  tools/
    start.ps1        banner, checagem do ambiente e instalação
    make-shortcut.ps1 cria o atalho da área de trabalho
    ...              captura de tela, teste via CDP e gerador de ícone
  data/config.json   preferências salvas (criado em tempo de execução)
  data/logs/         log da preparação do DexNom (criado em tempo de execução)
```

O ícone da janela e do atalho é `app\assets\icon.ico`. Para trocar, substitua `icon.png` e rode `npm run icon`; o script gera um ICO com tamanhos de 16 a 256 px. O `CRIAR-ATALHO.cmd` usa esse ícone.

## Créditos

- Launcher, interface e direção visual: **Nicolas Garcia (Nico.SCI)**.
- Corrida, tracker e dados: **PortWatch VI**, de **4lwayz** e colaboradores.
- Silhueta da palmeira derivada da foto **“Phoenix canariensis in silhouette at sunset, Palm Lakes Resort, Ballina NSW”**, de John Robert McPherson, em domínio público (CC0), via Wikimedia Commons.
- Tipografia: **Anton**, **Yellowtail** e **Inter**, sob a SIL Open Font License, com arquivos locais em `app/fonts`.
- O launcher não redistribui arquivos do jogo.

## Problemas comuns

- **“Sem conexão” no tracker:** confira a internet e tente **Atualizar**; se o GitHub estiver fora do ar, o hub usa o último cache local.
- **Lista de forks vazia:** a API do GitHub pode ter atingido o limite. Preencha um token em **Ajustes → Tracker** e atualize.
- **Download falhou:** confira a conexão e o espaço em disco. O detalhe do erro aparece no diálogo.
- **O ZIP não extraiu:** feche o arquivo no Explorer e tente de novo; o download é mantido na pasta de downloads.
- **“Faltam pré-requisitos” ao preparar o DexNom:** instale o Rust e o Visual Studio Build Tools com a carga C++ e o Windows SDK; clique em **Verificar** depois. Se o Build Tools já existe, use **Localizar Build Tools** e escolha a pasta que contém `VC\Tools\MSVC`. Para a instalação automática, use **Instalar Build Tools** ou o comando `winget` sugerido na tela. Se a instalação automática terminar sem detectar o Build Tools, reinicie o Windows e use **Verificar** de novo.
- **Build Tools instalado em outro disco mas não detectado:** use **Localizar Build Tools** e aponte a pasta da instalação (por exemplo, `D:\VSBuildTools`). O launcher passa a usar o `vcvars64.bat` dessa instalação, sem baixar nada. Isso também funciona quando o `vswhere` não lista a instalação.
- **A instalação do Build Tools falhou:** abra o log em `data\logs\msvc-install.log` e confira a conexão, o espaço livre (cerca de 6 GB no C:) e se a janela do UAC foi aceita. O instalador oficial também pode ser aberto manualmente pelo botão **Abrir Build Tools**.
- **O DexNom não inicia o jogo:** confirme que o runtime foi preparado, que o `.exe` apontado é o da instalação correta e que a GPU suporta mesh shaders/Shader Model 6.6. Veja o log em `data\logs\dexnom-setup.log` e os diagnósticos do runtime em `%LOCALAPPDATA%\DexNom Runtime\logs`.
- **O launcher não abre:** rode `INICIAR.cmd`; ele mostra o que falta (Node.js, npm ou dependências) e tenta instalar. Se o atalho estiver apontando para uma pasta antiga, rode `CRIAR-ATALHO.cmd` de novo.

---

Projeto pessoal e experimental, sem vínculo com a Rockstar Games ou a Take-Two Interactive. GTA, GTA VI e Los Santos pertencem aos seus respectivos donos.
