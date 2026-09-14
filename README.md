# Vota

Aplicação para votação de apresentações em tempo real.

## Iniciar

Com o Node.js instalado, execute na pasta do projeto:

```powershell
node server.js
```

No mesmo computador, abra `http://localhost:3000`. Para participantes na mesma rede Wi-Fi, partilhe `http://IP-DO-COMPUTADOR:3000` (por exemplo, `http://192.168.1.20:3000`).

O PIN inicial da área de gestão é `4826`. Antes de publicar, defina um PIN próprio na variável de ambiente `MANAGER_PIN`.

## Notas de utilização

- Os votos, a votação atual e o histórico ficam guardados no ficheiro `votacoes.json` criado pelo servidor.
- A votação atual é atualizada automaticamente em todos os dispositivos que abriram o link.
- Cada navegador recebe uma identificação persistente e pode alterar apenas o seu próprio voto enquanto a votação estiver aberta.
- Para partilhar fora da rede local, publique este projeto num servidor acessível pela internet com HTTPS.
