# merchant-network

Elite Merchant and Patron Group

## Run Rest Server

* `composer network install --card PeerAdmin@hlfv1 --archiveFile networkadmin.card`
* `composer archive create -t dir -n .`
* `composer card import --file networkadmin.card`
* `composer network install --card PeerAdmin@hlfv1 --archiveFile merchant-network@0.0.2.bna`
* `composer-rest-server`
** Use `admin@merchant-network` card
** Choose `never use namespaces`
** Choose default options for the rest
* Go to http://localhost:3000/explorer for Swagger UI