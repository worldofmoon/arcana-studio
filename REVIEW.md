# Arcana Studio — revisão funcional (12/10/2026)

Revisão do código e dos fluxos de importação, edição, biblioteca e impressão.

## Correções

- Importações concorrentes preservam a última carta e face escolhidas.
- Arte ausente ou com erro não mantém a imagem da carta anterior.
- Importar outra carta desvincula o editor do projeto salvo, evitando sobrescrita acidental.
- Abertura de projetos valida campos, opções, imagens e fontes antes de aplicar o estado.
- Projetos antigos recebem valores padrão nos campos ausentes.
- Carregamentos concorrentes de projetos, imagens e fontes não aplicam resultados ultrapassados.
- Exportações aguardam o carregamento e fontes podem ser restauradas com segurança.
- Força/resistência tem contraste próprio nos painéis de molduras escuras.
- Consultas ao Scryfall e carregamento de imagens têm limite de espera.
- O histórico não intercepta desfazer nos campos de busca ou organização da biblioteca.
- Backups e projetos exportados respeitam os limites de tamanho e quantidade aceitos na restauração.
- Downloads mantêm o endereço temporário por mais tempo; busca tem o mesmo estilo dos demais campos.

## Verificações executadas

Testes automatizados com DOM simulado e canvas nativo: 32 molduras, 80 símbolos, busca e paginação, importação de faces e layouts especiais, edição de texto, camadas, marca-d’água, fontes, histórico, projetos antigos e atuais, pastas, backups completos/selecionados e restauração como cópias.

Casos adicionais: respostas fora de ordem, falha de imagem, dados inválidos, cancelamento de upload, dois uploads simultâneos, duas fontes simultâneas, reset de fonte durante carregamento, carregamentos concorrentes de projeto e preservação do estado após PDF.

PNG verificado com corpo 1260 × 1760 px e exportação 1380 × 1880 px, densidade de 20.000 pixels/m: carta 63 × 88 mm com margem branca de 3 mm. PDFs A4 e Letter conferidos com tamanho físico 69 × 94 mm por imagem e espelhamento dos versos pela borda longa.

O pacote publicado foi testado com seu carregador e os arquivos servidos pelo GitHub Pages são conferidos após o deploy.

## Limites da revisão

Não havia ferramenta de navegador de teste nesta sessão. Os testes de DOM/canvas não substituem a validação de cliques, rolagem, gestos e downloads em um Safari/iPhone real. Não foi feita impressão física; alinhamento e escala também dependem da configuração e das margens da impressora.
