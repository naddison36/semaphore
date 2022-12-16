import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof, packToSolidityProof } from "@semaphore-protocol/proof"
import { expect } from "chai"
import download from "download"
import { existsSync } from "fs"
import { ethers, run } from "hardhat"
import { Greeter } from "../typechain-types"

describe("Greeter", () => {
    let greeter: Greeter

    const snarkArtifactsURL = "https://www.trusted-setup-pse.org/semaphore/20"
    const snarkArtifactsPath = "./artifacts/snark"

    const users: any[] = []
    const groupId = "42"
    const group = new Group()

    before(async () => {
        if (!existsSync(`${snarkArtifactsPath}/semaphore.wasm`)) {
            await download(`${snarkArtifactsURL}/semaphore.wasm`, `${snarkArtifactsPath}`)
            await download(`${snarkArtifactsURL}/semaphore.zkey`, `${snarkArtifactsPath}`)
        }

        greeter = await run("deploy", { logs: false, group: groupId })

        users.push({
            identity: new Identity(),
            username: ethers.utils.formatBytes32String("anon1")
        })

        users.push({
            identity: new Identity(),
            username: ethers.utils.formatBytes32String("anon2")
        })

        group.addMember(users[0].identity.generateCommitment())
        group.addMember(users[1].identity.generateCommitment())
    })

    describe("# joinGroup", () => {
        it("Should allow users to join the group", async () => {
            for (let i = 0; i < group.members.length; i += 1) {
                const transaction = greeter.joinGroup(group.members[i], users[i].username)

                await expect(transaction).to.emit(greeter, "NewUser").withArgs(group.members[i], users[i].username)
            }
        })
    })

    describe("# greet", () => {
        it("Should allow users to greet", async () => {
            const greeting = ethers.utils.formatBytes32String("Hello World")

            const fullProof = await generateProof(users[1].identity, group, groupId, greeting, {
                wasmFilePath: `${snarkArtifactsPath}/semaphore.wasm`,
                zkeyFilePath: `${snarkArtifactsPath}/semaphore.zkey`
            })
            const solidityProof = packToSolidityProof(fullProof.proof)

            const transaction = greeter.greet(
                greeting,
                fullProof.publicSignals.merkleRoot,
                fullProof.publicSignals.nullifierHash,
                solidityProof
            )

            await expect(transaction).to.emit(greeter, "NewGreeting").withArgs(greeting)
        })
    })
})