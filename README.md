# merchant-network

Elite Merchant and Patron Group

## Run Rest Server

* `composer archive create -t dir -n .`
* `composer card import --file networkadmin.card`
* `composer network install --card PeerAdmin@hlfv1 --archiveFile merchant-network@0.0.2.bna`
* `composer network start --networkName merchant-network --networkVersion 0.0.2 --networkAdmin admin --networkAdminEnrollSecret adminpw --card PeerAdmin@hlfv1 --file networkadmin.card`
* `composer network ping --card admin@merchant-network`
* `composer-rest-server`
** Use `admin@merchant-network` card
** Choose `never use namespaces`
** Choose default options for the rest
* Go to http://localhost:3000/explorer for Swagger UI