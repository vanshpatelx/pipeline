helm install postgres1 -f ./postgresql/values-db1.yaml ./postgresql
helm install postgres2 -f ./postgresql/values-db2.yaml ./postgresql
# helm uninstall postgres1 -f ./postgresql/values-db1.yaml ./postgresql
# helm uninstall postgres2 -f ./postgresql/values-db2.yaml ./postgresql
