# Fuel Intelligence — base do novo painel

Esta pasta contém a primeira extração auditável dos relatórios Globus e do cadastro NOVEMBRO 26.

## Arquivos

- `manifest.json`: período, contagens, totais e pendências da extração.
- `veiculos.json`: cadastro mestre com prefixo, empresa, modelo, placa, ano e chassi.
- `prefixos-relatorios.json`: prefixos, placas e tipo de frota conforme cabeçalhos dos TXT.
- `abastecimentos-*.json`: movimentações estruturadas por faixa de prefixo.
- `pendencias.json`: linhas que não foram interpretadas automaticamente.

## Painel

O HTML independente está em `/painel-inteligencia.html`. Ele carrega estes arquivos via caminhos relativos, portanto funciona publicado no GitHub Pages ou servido por um servidor HTTP local; abrir diretamente como `file://` bloqueia a leitura dos JSON em alguns navegadores.

## Regras de leitura

- Os códigos de tipo `E` e `I` são mantidos como aparecem no relatório; seu significado operacional deve ser confirmado com o responsável pelo Globus.
- Consumo ponderado = soma de KM positivos / soma de litros dos registros com KM positivo. É um indicador aproximado do relatório, não substitui telemetria ou medição tanque cheio a tanque cheio.
- Linhas com KM zero não entram no consumo km/L.
- Divergências, hodômetros regressivos e duplicidades são sinais de auditoria, não provas de fraude.
- Empresa do relatório e empresa do cadastro são mantidas separadas.
- Uma linha de `500-700.TXT` com campos desalinhados permanece em `pendencias.json`, fora dos totais automáticos.

## Origem e período

Relatórios emitidos em 16/11/2026, período indicado de 01/07/2026 a 16/11/2026. O cadastro foi extraído de `NOVEMBRO 26.html`.

## Limitações conhecidas

Ainda não há base estruturada de notas de compra, estoque inicial/final, aferições físicas de tanque, transferências internas ou identificação de motorista em cada linha. O módulo de fluxo do combustível apresenta essas etapas como lacunas de dados, sem inventar valores.
