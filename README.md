# 🏰 Realm Rising

Jogo 2D de **construção de reino + estratégia idle** que roda direto no navegador (desktop e celular).
Você começa com **duas pessoas e uma fogueira** numa clareira e, por escolhas graduais, transforma o acampamento num **império**.
Os moradores trabalham sozinhos (cortam árvores, colhem, constroem, caçam); você é o líder: define prioridades, constrói, decide políticas e reage a eventos.

> Canvas 2D puro + módulos ES, **sem build e sem dependências** — toda a arte (terreno, árvores, prédios, personagens, ícones) é gerada proceduralmente em tempo de execução. Progresso salvo em `localStorage`.

## Como rodar

```bash
node test/serve.mjs 8080      # servidor estático mínimo (qualquer servidor estático serve)
# abra http://localhost:8080
```

Também funciona publicado como site estático (GitHub Pages, Netlify, etc.): é só servir a pasta.

## Jogar online
https://umcafecommundo-ctrl.github.io/realm-rising/ (publicado pelo workflow `.github/workflows/pages.yml`).

## Como jogar

* **Câmera:** arraste para mover; roda do mouse / pinça para zoom. Toque num morador ou prédio para ver detalhes.
* **Tutorial guiado** no primeiro jogo (setas, destaques, uma mecânica por vez); dicas contextuais aparecem quando algo novo é liberado.
* **Objetivos** (curto/médio/longo prazo) e **alertas coloridos** (verde = ok, amarelo = atenção, vermelho = perigo) ficam sempre visíveis.
* Atalhos: `Espaço` pausa · `1/2/3` velocidade · `B` construir · `P` povo · `J` trabalho · `T` pesquisa · `Esc` cancela.
* **Distribuição automática** (aba Trabalho): moradores "Livres" vão sozinhos para onde há necessidade (comida, água, obras, madeira, vagas nos prédios); escolhas manuais são respeitadas.
* **Automação do conselho** (políticas, todas ligadas por padrão): **pesquisa automática** (primeiro o que a próxima era e os prédios exigem), **construção automática** (necessidades do reino e requisitos de era, só com excedente) e **evolução de era automática** quando requisitos e custo estão prontos. Conquistas de território (era Império) continuam manuais.
* **Piloto automático total** (políticas ligadas por padrão, você só acompanha): pesquisa, construção, evolução de era, **decisões de eventos**, festivais/impostos, **exploração, diplomacia e conquista** de alvos fracos. Dá para desligar cada uma na aba Política.
* **Foco na próxima era:** a distribuição de trabalhadores olha o que falta para evoluir (pedra, madeira, tábuas, ferro, ouro): mais pedreiros/lenhadores/comerciantes onde há déficit, serrarias extras se faltam tábuas, mina quando falta pedra e depósitos se o custo da era nem cabe no armazém. A exploração do mundo roda sozinha (até 2 batedores).
* **Mais profundidade (para o jogo não acabar rápido):**
  * **Evoluções de construções (tier 2/3, com ⭐):** casa → casa de pedra → mansão · fazenda → fazenda irrigada · poço → cisterna · depósito → armazém real · serraria → hidráulica · ferraria → fundição · mercado → bazar · taverna → estalagem.
  * **3 maravilhas únicas com bônus globais:** Grande Biblioteca (+50% pesquisa), Colosso (+30% comércio, +defesa), Jardins Suspensos (+40% colheita, +felicidade), além da Grande Maravilha.
  * **Era 6 – Era Dourada:** Observatório e Palácio Imperial.
  * **9 novas tecnologias** e a pesquisa infinita **♾️ Aperfeiçoamento Contínuo** (+3% coleta/colheita/pesquisa por nível).
  * **Legado / Ascensão:** com uma maravilha construída, Menu → 🌟 Ascender reinicia o reino mantendo bônus permanentes (+4% por ponto, recursos e pesquisas iniciais).
  * Novos eventos (cometa, casamento real, Grande Peste), 10 novas missões e 7 conquistas.
* **Evoluir e mover construções:** selecione uma construção e use **⬆ Evoluir** (abrigo → casa, área de coleta → depósito; o conselho também faz isso sozinho com o excedente) e **✥ Mover** (qualquer prédio; custa 25% se já pronto, e a posição fica 📌 fixada). **📐 Organizar reino agora** (aba Construir) leva tudo para os distritos; o conselho também reorganiza 1 prédio por dia.
* **Quando você está offline:** o conselho constrói o que o reino precisa (moradia, depósitos, fazendas, poço, serraria, mercado…) usando só o excedente e mantendo reservas; as obras são posicionadas em **distritos organizados** (residencial a oeste, agrícola ao norte, industrial a leste, cívico ao sul, real a noroeste, militar a sudeste) e obras suas fora do distrito são **realocadas** (grátis em obra; 25% do custo se prontas). Política "Construção automática" liga/desliga.
* **Save seguro:** salva a cada 5 s, após cada interação e ao sair, com cópia de segurança; o relatório offline fica guardado até você lê-lo.
* Botão **?** em cada painel explica o que ele faz.

### O que existe

| Área | Conteúdo |
|---|---|
| **Eras** | Acampamento → Vila → Cidade → Reino → Império (cada uma libera construções, profissões e mecânicas; território cresce) |
| **Recursos** | madeira, pedra, comida, água · tábuas, ferramentas, tecido, ferro · ouro, armas, joias — com **cadeias de produção** e **armazenamento limitado** |
| **Povo** | nome, idade, fome/sono/humor/saúde, habilidade que cresce com o uso; casais, filhos, imigrantes, doenças, fugas; 10 profissões + moradores livres |
| **Construções** | 23 tipos (fogueira, abrigo, casa, fazenda, poço, serraria, depósito, mercado, ferraria, mina, quartel, muralha, taverna, castelo, catedral, porto, academia, estrada, monumento, Grande Maravilha…) com **fundação → andaime → pronto** |
| **Tecnologia** | árvore vertical de 19 pesquisas que liberam construções e dão bônus |
| **Políticas** | impostos, racionamento, trabalho extra, recrutamento obrigatório, fronteira, postura diplomática, festivais |
| **Eventos** | 21 eventos com 2–3 opções (inverno rigoroso, praga, doença, incêndio, lobos, bandidos, mercador, refugiados, minério, rebelião, heróis…) |
| **Mundo** | mapa-múndi 16×12 com **névoa de guerra**, batedores, 4 reinos de IA (pacífico / agressivo / comerciante), diplomacia (presentes, paz, aliança, tributo), rotas comerciais com caravanas |
| **Guerra** | 5 tipos de unidade com contra-ataques, treino no quartel, batalhas automáticas com **animação e relatório**, defesa (muralhas/castelo), conquista de territórios que rendem recursos |
| **Offline** | até **12 h** de ausência (1 s offline = 0,2 s de jogo, 70% de eficiência). Ao voltar: **Relatório do Reino** (população, recursos, eventos resolvidos, batalhas, fome/frio/fugas, veredito) |
| **Visual** | dia/noite com luz de fogueira, tochas e janelas acesas · 4 estações (neve no inverno) · chuva e tempestade com raios · folhas, fumaça, faíscas, poeira, vaga-lumes · números flutuantes |

### Dificuldade
Recursos são escassos no início, o inverno exige preparação (sem colheita; lenha para aquecer) e más decisões geram crises reais.
Mas o jogo **sempre avisa antes** ("Comida acaba em 2 dias", "Inverno em 5 dias: faltam ~40 de comida"), e é possível se recuperar:
se o reino for esvaziado, sobreviventes chegam para recomeçar; offline, o povo **emigra** antes de morrer em massa.

## Arquitetura (`js/`)

| Módulo | Responsabilidade |
|---|---|
| `data.js` | Todas as definições estáticas: recursos, profissões, construções, eras, tecnologias, unidades, políticas, constantes de tempo |
| `state.js` | Estado do jogo, geração do mapa (semente), save/load (`localStorage`), migração |
| `core.js` | Ajudantes de lógica sem DOM (recursos, pessoas, defesa, barramento de eventos) |
| `sim.js` | Relógio, estações, clima, necessidades, produção, população, API de ações (construir, trabalhos, políticas, eras) e alertas |
| `ai.js` + `path.js` | Comportamento dos moradores (tarefas, A*) e animais — modo "ao vivo" |
| `events.js` | Eventos aleatórios com escolhas e a escolha automática usada offline |
| `world.js` / `war.js` | Mapa-múndi, reinos de IA, diplomacia, comércio · exército, batalhas e conquista |
| `offline.js` | Simulação da ausência + montagem do relatório |
| `quests.js` | Objetivos e conquistas |
| `art.js` / `art_b.js` | Arte procedural (terreno, árvores, rochas, ícones · construções, andaimes) |
| `render.js` | Câmera, desenho do mundo, partículas, iluminação, clima, entrada por mouse/toque |
| `ui.js` / `panels.js` / `worldui.js` / `tutorial.js` | HUD, painéis, modais, mapa-múndi/guerra, tutorial |
| `main.js` | Inicialização, laço principal, autosave (10 s) e offline |

A simulação (`sim`, `ai`, `events`, `world`, `war`, `offline`) **não depende do DOM** — roda em Node para testes.
Valores de equilíbrio ficam em `data.js` (`DAY_LEN`, `OFFLINE_SCALE`, `OFFLINE_EFF`, `OUT_RATE`, custos…).

## Testes

```bash
npm test                    # fumaça da simulação (headless)
node test/stress.mjs        # eventos, mundo, guerra, offline de 12 h e save/load
node test/bot.mjs 120 777   # bot joga 120 min de jogo (OFF=8 simula 8 h offline ao final)
node test/ui.cjs desktop    # screenshots de painéis (precisa do servidor e de Playwright)
node test/flow.cjs desktop  # tutorial por cliques, construção, relatório offline
node test/mobile.cjs        # fluxo por toque em viewport de celular
```

## Licença
MIT
