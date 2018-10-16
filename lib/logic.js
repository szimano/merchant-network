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

/*global query*/

'use strict';

const uuid = ()=>([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,a=>(a^Math.random()*16>>a/4).toString(16));

/** 
 * Send Tokens
 * @param {org.szimano.merchantnetwork.SendTokens} tokens
 * @transaction
 */
async function send(tokens) {
    console.log(`Sending tokens ${tokens}`);
}

/** 
 * List ArtWork
 * @param {org.szimano.merchantnetwork.ListArtWork} artWorkListing
 * @transaction
 */
async function list(artWorkListing) {
    console.log(`Listing artwork ${JSON.stringify(artWorkListing)}`);

    const artWorkRegistry = await getAssetRegistry('org.szimano.merchantnetwork.ArtWork');
    const tokenRegistry = await getAssetRegistry('org.szimano.merchantnetwork.ArtToken');

    const artWork = getFactory().newResource('org.szimano.merchantnetwork', 'ArtWork', uuid());
    artWork.description = artWorkListing.artWorkDescription;
    artWork.merchant = artWorkListing.owner;

    console.log(artWork);

    const ptx = await artWorkRegistry.add(artWork);

    console.log(`PTX: ${ptx}`)

    const token = getFactory().newResource('org.szimano.merchantnetwork', 'ArtToken', uuid());
    token.tokenName =  artWorkListing.tokenName;
    token.owner = artWorkListing.owner;
    token.artWork = artWork;

    // const newTokens = Array(artWorkListing.tokenInitalBalance).fill(1).map((e) => {
    //     const t = getFactory().newResource('org.szimano.merchantnetwork', 'ArtToken', uuid());
    //     t.tokenName =  artWorkListing.tokenName;
    //     t.owner = artWorkListing.owner;
    //     t.artWork = artWork;
    //     return t;
    // });

    // console.log(newTokens);

    const tx = await tokenRegistry.add(token);
    console.log(`Token: ${token}`)

    console.log(`TX: ${tx}`)
}