# Arcana Studio

Editor estático de cartas e proxies de Magic, publicado em [GitHub Pages](https://worldofmoon.github.io/arcana-studio/).

## Desenvolvimento

Node.js 20 ou superior:

```sh
npm ci
npm run check
npm test
npm run dev
```

O servidor local abre em `http://127.0.0.1:4173`. O site utiliza ES modules nativos e não precisa de build ou dependências em produção. Abrir o HTML com `file://` não é suportado; use o servidor HTTP.

## Organização

| Diretório            | Responsabilidade                                                     |
| -------------------- | -------------------------------------------------------------------- |
| `src/core`           | Facade, composição dos serviços e estado por instância               |
| `src/domain`         | Configuração e validação dos formatos de projetos/backups            |
| `src/services`       | Cartas, imagens, fontes, projetos, histórico, biblioteca e impressão |
| `src/rendering`      | Geometria, tipografia, desenho da carta e árvore de camadas          |
| `src/infrastructure` | Adapters para Scryfall/IndexedDB e Proxy de recursos                 |
| `src/ui`             | Adapter do DOM, eventos e controles do editor                        |
| `styles`             | CSS da interface e declarações das fontes                            |
| `assets`             | Catálogo, símbolos, fontes e molduras PNG independentes              |
| `tests`              | Testes estruturais e regressão de funcionalidades                    |
| `scripts`            | Servidor local e checagem de módulos/recursos                        |

O HTML contém apenas a interface e referências aos arquivos externos. As molduras maiores são carregadas sob demanda, em vez de transportar todos os PNGs dentro do HTML.

## Arquitetura

Veja [a documentação da arquitetura](docs/ARCHITECTURE.md), baseada nos padrões estruturais do [Refactoring.Guru](https://refactoring.guru/pt-br/design-patterns/structural-patterns).

Os formatos de projeto `arcana-studio` v2, backup `arcana-library` v1 e o banco IndexedDB `arcana-studio`/`projects` v1 permanecem compatíveis.

## Projetos com várias cartas

Abra **Cartas deste projeto** para adicionar ou duplicar cartas e escolher a carta que deseja editar. Cada carta mantém seus próprios campos, imagens e histórico de edição. Também é possível renomear, ordenar, excluir e definir quantidades para impressão. O projeto mantém pelo menos uma carta e aceita até 100 cartas.

O verso pode ser compartilhado com todas as cartas; a moldura e as cores podem ser aplicadas ao conjunto. Em **Finalizar**, baixe um projeto completo, prepare um PDF com as quantidades de cada carta ou baixe um ZIP com um PNG por carta no lado escolhido. PNGs continuam medindo 69 × 94 mm, incluindo a margem branca de 3 mm.

Conjuntos usam `arcana-project` v1 e contêm snapshots `arcana-studio` v2. Arquivos antigos continuam abrindo como uma carta. Autosave, biblioteca local e backups preservam o conjunto inteiro. Projetos baixados incluem as imagens remotas convertidas para dados locais; o limite de arquivo continua em 60 MB e o ZIP em 200 MB.

## Testes e publicação

`npm run check` verifica a sintaxe, imports, referências do HTML e arquivos das molduras. `npm test` executa testes de padrões e regressão com DOM simulado e canvas nativo: importação, faces, camadas, fontes, histórico, biblioteca, backups, PNG/PDF e concorrência.

GitHub Actions executa os testes em pushes e pull requests. O GitHub Pages mantém a publicação estática a partir da raiz da branch `main`.

Os testes não substituem validação de gestos e downloads em Safari/iPhone real nem uma impressão física.

## Créditos

Projeto independente, sem afiliação à Wizards of the Coast. Dados e símbolos de edições via Scryfall. Elementos de Magic, fontes e recursos de referência mantêm os direitos de seus respectivos criadores; veja os créditos na interface e em [assets/README.md](assets/README.md).
