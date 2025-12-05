version=v0.0.1
docker tag docker-helios-backups-provider:$version heliosfoundation/docker-helios-backups-provider:$version
docker push heliosfoundation/docker-helios-backups-provider:$version
docker tag docker-helios-backups-provider:$version heliosfoundation/docker-helios-backups-provider:latest
docker push heliosfoundation/docker-helios-backups-provider:latest