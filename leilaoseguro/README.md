# Pagamentos PIX com AllowPay

O checkout usa as funcoes Node.js da Vercel. Configure a pasta raiz do projeto
como `leilaoseguro` para servir as paginas e as rotas `/api` no mesmo dominio.
Use Node.js 22 ou superior.

## Variaveis de ambiente do servidor

- `ALLOWPAY_API_KEY`: chave do seller, obrigatoria. Cadastre-a nas variaveis
  privadas da Vercel; nunca em HTML, JavaScript do navegador ou arquivos versionados.
- `ALLOWPAY_ORIGIN`: origem publica do site, por exemplo `https://sualoja.com`.
  Pode usar `PUBLIC_URL` como alternativa. Sem ambas, a origem da requisicao
  e usada somente quando corresponde ao host do servidor.
- `ALLOWPAY_BASE_URL`: opcional; padrao `https://allow-gi0i.onrender.com`.
- `UTMIFY_API_TOKEN`: opcional, preserva o envio de pedidos existente.

Depois de configurar as variaveis, publique novamente o projeto. Arquivos `.env`
locais sao ignorados pelo Git. A chave compartilhada em conversa deve ser
rotacionada no painel e a nova chave configurada apenas no servidor.

## Fluxo

1. O servidor valida nome, e-mail, CPF com digitos verificadores e telefone com
   DDD. O valor em centavos e calculado pelo catalogo do servidor.
2. `/api/create-pix` envia `X-AllowPay-Origin` e nunca fixa `route`.
3. O checkout mostra o QR Code retornado pela AllowPay e o codigo copia-e-cola.
   Armazena `transactionId`, `pixRoute` e a data na sessao do navegador.
4. `/api/check-payment` consulta o `txid` com a `route` retornada. As consultas
   ocorrem a cada 5 segundos, sem sobreposicao, enquanto aguarda pagamento.
5. Apenas `approved` confirma o pagamento. Os demais estados terminais encerram
   a consulta com mensagem especifica. Falhas temporarias sao exibidas e
   retentadas; erros de configuracao/requisicao interrompem a consulta.
6. O envio do pedido pago a Utmify reconsulta a AllowPay no servidor antes de
   reportar a aprovacao.

Esta integracao usa **polling**, nao envia `webhook_url` nem `webhook_secret`.
O endpoint de webhook legado apenas registra eventos: nao confirma pedidos e
nao deve ser usado como alternativa sem armazenamento persistente e
idempotencia por `event_id`.

## Validacao

Execute da pasta raiz do repositorio:

```powershell
node --test .\leilaoseguro\tests\allowpay.test.js
```

Os testes usam respostas simuladas: nao geram cobrancas nem enviam dados de
clientes. A verificacao real de pagamento exige deploy, variaveis configuradas
e uma transacao autorizada.
