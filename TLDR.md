## Init
 
`spg init --config conf/francoisgeorgy-ch.json --force`

## Build

`spg build --recursive --cloudflare --prune --gallery /Users/francois/photos/publish`

## Deploy

```bash
# deploy the built gallery (draft preview, then production)
./scripts/deploy-netlify.sh -c conf/francoisgeorgy-ch.json
./scripts/deploy-netlify.sh -c conf/francoisgeorgy-ch.json --prod

# build (recursive, cloudflare and prune come from the config), then deploy
./scripts/deploy-netlify.sh -c conf/francoisgeorgy-ch.json --build --prod
```
