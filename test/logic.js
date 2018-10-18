/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
/**
 * Write the unit tests for your transction processor functions here
 */

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const namespace = 'org.szimano.merchantnetwork';
const personType = 'Person';
const personNS = namespace + '.' + personType;
const merchantType = 'Merchant';
const merchantNS = namespace + '.' + merchantType;
const artTokenType = 'ArtToken';
const artTokenNS = namespace + '.' + artTokenType;
const artWorkType = 'ArtWork';
const artWorkNS = namespace + '.' + artWorkType;
const moneyTrasferType = 'MoneyTransfer';
const moneyTransferNS = namespace + '.' + moneyTrasferType;

describe('#' + namespace, () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );

    // Embedded connection used for local testing
    const connectionProfile = {
        name: 'embedded',
        'x-type': 'embedded'
    };

    // Name of the business network card containing the administrative identity for the business network
    const adminCardName = 'admin';

    // Admin connection to the blockchain, used to deploy the business network
    let adminConnection;

    // This is the business network connection the tests will use.
    let businessNetworkConnection;

    // This is the factory for creating instances of types.
    let factory;

    // These are the identities for Alice and Bob.
    const aliceCardName = 'alice';
    const bobCardName = 'bob';
    const merchantCardName = 'merchant';

    // These are a list of receieved events.
    let events;

    let businessNetworkName;

    before(async () => {
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

        // Identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);
        const deployerCardName = 'PeerAdmin';

        adminConnection = new AdminConnection({ cardStore: cardStore });

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    /**
     *
     * @param {String} cardName The card name to use for this identity
     * @param {Object} identity The identity details
     */
    async function importCardForIdentity(cardName, identity) {
        const metadata = {
            userName: identity.userID,
            version: 1,
            enrollmentSecret: identity.userSecret,
            businessNetwork: businessNetworkName
        };
        const card = new IdCard(metadata, connectionProfile);
        await adminConnection.importCard(cardName, card);
    }

    // This is called before each test is executed.
    beforeEach(async () => {
        // Generate a business network definition from the project directory.
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        businessNetworkName = businessNetworkDefinition.getName();
        await adminConnection.install(businessNetworkDefinition);
        const startOptions = {
            networkAdmins: [
                {
                    userName: 'admin',
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkName, businessNetworkDefinition.getVersion(), startOptions);
        await adminConnection.importCard(adminCardName, adminCards.get('admin'));

        // Create and establish a business network connection
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', event => {
            events.push(event);
        });
        await businessNetworkConnection.connect(adminCardName);

        // Get the factory for the business network.
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();

        const personRegistry = await businessNetworkConnection.getParticipantRegistry(personNS);
        // Create the drivers.
        const alice = factory.newResource(namespace, personType, 'person1');
        alice.name = 'Alice';

        const bob = factory.newResource(namespace, personType, 'person2');
        bob.name = 'Bob';

        personRegistry.addAll([alice, bob]);

        const merchantRegistry = await businessNetworkConnection.getParticipantRegistry(merchantNS);
        // Create the assets.
        const merchant = factory.newResource(namespace, merchantType, 'merchant1');
        merchant.name = 'Merchant';

        merchantRegistry.addAll([merchant]);

        // Issue the identities.
        let identity = await businessNetworkConnection.issueIdentity(personNS + '#person1', 'alice1');
        await importCardForIdentity(aliceCardName, identity);
        identity = await businessNetworkConnection.issueIdentity(personNS + '#person2', 'bob1');
        await importCardForIdentity(bobCardName, identity);
        identity = await businessNetworkConnection.issueIdentity(merchantNS + '#merchant1', 'merchant1');
        await importCardForIdentity(merchantCardName, identity);
    });

    const uuid = ()=>([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,a=>(a^Math.random()*16>>a/4).toString(16));

    async function useIdentity(cardName) {
        await businessNetworkConnection.disconnect();
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });
        events = [];
        businessNetworkConnection.on('event', (event) => {
            events.push(event);
        });
        await businessNetworkConnection.connect(cardName);
        factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    }

    async function listArtWork(ownerId, tokenName, tokenInitalBalance, artWorkDescription, shouldRejectReason = null) {
        const transaction = factory.newTransaction(namespace, 'ListArtWork');
        transaction.tokenName = tokenName;
        transaction.tokenInitalBalance = tokenInitalBalance;
        transaction.artWorkDescription = artWorkDescription;
        transaction.owner = factory.newRelationship(namespace, merchantType, ownerId);

        if (shouldRejectReason) {
            businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(shouldRejectReason);    
        } else {
            return await businessNetworkConnection.submitTransaction(transaction);       
        } 
    }

    async function sendTokens(artWork, from, to, amount, shouldRejectReason = null) {
        const transaction = factory.newTransaction(namespace, 'SendTokens');
        transaction.artWork = factory.newRelationship(namespace, artWorkType, artWork);
        transaction.from = factory.newRelationship(namespace, merchantType, from);
        transaction.to = factory.newRelationship(namespace, personType, to);
        transaction.amount = amount;

        if (shouldRejectReason) {
            businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(shouldRejectReason);    
        } else {
            await businessNetworkConnection.submitTransaction(transaction);       
        } 
    }

    async function sellArt(artWorkId, shouldRejectReason = null) {
        const transaction = factory.newTransaction(namespace, 'SellArtWork');
        transaction.artWork = factory.newRelationship(namespace, artWorkType, artWorkId);

        if (shouldRejectReason) {
            businessNetworkConnection.submitTransaction(transaction).should.be.rejectedWith(shouldRejectReason);    
        } else {
            await businessNetworkConnection.submitTransaction(transaction);       
        } 
    }

    async function markAllTokensForSale(cardName, person, artWorkId) {
        await useIdentity(cardName)

        const personTokens = await businessNetworkConnection.query('selectTokensByOwnerAndArt', {
            owner: `resource:org.szimano.merchantnetwork.Person#${person}`,
            artWork: `resource:org.szimano.merchantnetwork.ArtWork#${artWorkId}`
        });  

        const saleTokens = personTokens.map((pt) => {pt.onSale = true; return pt});

        const artTokenRegistry = await businessNetworkConnection.getAssetRegistry(artTokenNS);

        await artTokenRegistry.updateAll(saleTokens);
    }

    it('Merchant can list an artwork', async () => {
        // // given
        // await useIdentity(merchantCardName);
        // const tokensToIssue = 50;

        // // when
        // const listedArtWork = await listArtWork('merchant1', 'ART', tokensToIssue, 'Mona Lisa by Leonardo d. V.');

        // // then
        // const artTokenRegistry = await businessNetworkConnection.getAssetRegistry(artTokenNS);        
        // const artWorkRegistry = await businessNetworkConnection.getAssetRegistry(artWorkNS);        

        // let artWorks = await artWorkRegistry.getAll();
        // artWorks.should.have.lengthOf(1);

        // let tokens = await artTokenRegistry.getAll();
        // tokens.should.have.lengthOf(tokensToIssue);
    });

    // it('Persons can send tokens', async () => {
    //     // given
    //     await useIdentity(merchantCardName);
    //     const artWorkId = await listArtWork('merchant1', 'ART2', 100, 'Other Mona Lisa by Leonardo d. V.');

    //     const artTokenRegistry = await businessNetworkConnection.getAssetRegistry(artTokenNS);        
    //     let tokens = await artTokenRegistry.getAll();

    //     // when
    //     await sendTokens(artWorkId, 'merchant1', 'person1', 10)

    //     // then
    //     const personRegistry = await businessNetworkConnection.getParticipantRegistry(personNS);     
        
    //     const aliceTokens = await businessNetworkConnection.query('selectTokensByOwnerAndArt', {
    //         owner: `resource:org.szimano.merchantnetwork.Person#person1`,
    //         artWork: `resource:org.szimano.merchantnetwork.ArtWork#${artWorkId}`
    //     });    

    //     aliceTokens.length.should.equal(10);
    // });

    // it('Merchant can sell art that is marked for sale in >= 50% of tokens', async () => {
    //     // given
    //     await useIdentity(merchantCardName);

    //     const artWorkId = await listArtWork('merchant1', 'ART3', 100, 'Sixtine Chappel');

    //     await sendTokens(artWorkId, 'merchant1', 'person1', 50);
    //     await sendTokens(artWorkId, 'merchant1', 'person2', 50);

    //     await markAllTokensForSale(aliceCardName, 'person1', artWorkId);

    //     // expect
    //     await useIdentity(merchantCardName);

    //     await sellArt(artWorkId);
    // });

    // it('Merchant cannot sell art that is not marked for sale in >= 50% of tokens', async () => {
    //     // given
    //     await useIdentity(merchantCardName);

    //     const artWorkId = await listArtWork('merchant1', 'ART3', 100, 'Sixtine Chappel');

    //     await sendTokens(artWorkId, 'merchant1', 'person1', 20);
    //     await sendTokens(artWorkId, 'merchant1', 'person2', 80);

    //     await markAllTokensForSale(aliceCardName, 'person1', artWorkId);

    //     // expect
    //     await useIdentity(merchantCardName);

    //     await sellArt(artWorkId, "There is no quorum (50%) for selling the art.");
    // });
});
