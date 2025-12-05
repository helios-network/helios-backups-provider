version=v0.0.1
docker buildx build --platform linux/amd64 --load --build-context clone=./ --label version=$version -t docker-helios-backups-provider:$version -f ./Dockerfile .
