import {useContext, useState} from "react";

import { Heading, HeadingLevel } from 'baseui/heading'
import { ParagraphMedium, ParagraphSmall } from 'baseui/typography';
import { useSnackbar } from "baseui/snackbar";
import { Avatar } from "baseui/avatar";
import { Button } from "baseui/button";
import { useStyletron, expandBorderStyles } from 'baseui/styles';
import { ProgressSteps, Step } from "baseui/progress-steps";
import { Input, SIZE } from "baseui/input";

import { Context } from "../Context";

import { ethers, providers } from "ethers"
import { Biconomy } from "@biconomy/mexa"

import SubscriptionHubABI from "../artifacts/contracts/SubscriptionHub.sol/SubscriptionHub.json";

function Configuration(props) {
    const { context, setContext } = useContext(Context);

    const [configurationStep, setConfigurationStep] = useState(context.configured ? 2 : 0);
    const [connecting, setConnecting] = useState(false);
    const [contractAddress, setContractAddress] = useState("0x1343c4067081FFeCe94519aFDe9EA82fb260B381");
    const [confirming, setconfirming] = useState(false);

    const { enqueue } = useSnackbar();
    const [css] = useStyletron();

    const connectWallet = async () => {
        if (context.connected) {
            enqueue({
                message: "Wallet already connected",
                kind: "error",
            });
            return;
        }
        setConnecting(true);
        if (typeof window.ethereum === 'undefined') {
            console.error('MetaMask is not installed!');
            enqueue({
                message: 'MetaMask is not installed!',
                kind: "error",
            })
            return;
        }
        await window.ethereum?.request({method: 'eth_requestAccounts'});

        const _provider = new providers.Web3Provider(window.ethereum);
        await _provider._ready();
        const address = await _provider.getSigner().getAddress();

        const biconomy = new Biconomy(window.ethereum, {
            apiKey: process.env.REACT_APP_BICONOMY_API_KEY,
            debug: false,
            contractAddresses: ["0x1343c4067081FFeCe94519aFDe9EA82fb260B381"],
        });
        await biconomy.init();

        const updatedContext = context;
        updatedContext.connected = true;
        updatedContext.walletAddress = address;
        updatedContext.provider = _provider;
        updatedContext.biconomy = biconomy;
        setContext(updatedContext);
        setConnecting(false);
        enqueue({
            message: 'Wallet connected!',
        })
    }

    const contractAddressConfirm = async () => {
        setconfirming(true);
        let formattedAddress;
        try {
            formattedAddress = ethers.utils.getAddress(contractAddress);
        } catch (e) {
            enqueue({
                message: 'Address is not valid: ' + e.toString(),
                kind: "error",
            })
            setconfirming(false);
            return;
        }
        const contract = new ethers.Contract(formattedAddress, SubscriptionHubABI.abi, context.provider.getSigner());
        const biconomyContract = new ethers.Contract(formattedAddress, SubscriptionHubABI.abi, context.biconomy.ethersProvider);
        try {
            const identifier = await contract.getIdentifier();
            if (identifier !== "SubscriptionHub") {
                throw new Error("Not a SubscriptionHub contract");
            }
        } catch (e) {
            enqueue({
                message: 'Address is not valid: ' + e.toString(),
                kind: "error",
            })
            setconfirming(false);
            return;
        }

        const updatedContext = context;
        updatedContext.contract = contract;
        updatedContext.biconomyContract = biconomyContract;
        setContext(updatedContext)
        setconfirming(false);
    }

    const nextStep = async () => {
        setConfigurationStep(configurationStep + 1);
    }

    const configCompleted = async () => {
        props.configuredCallback();
        await nextStep();
        const updatedContext = context;
        updatedContext.configured = true;
        setContext(updatedContext);
    }

    return (
        <HeadingLevel>
            <Heading>Configuration</Heading>
            <ProgressSteps current={configurationStep}>
                <Step title="Connect with Metamask">
                    {context.connected ? (
                        <>
                            <div className={css({display: 'flex', alignItems: 'center'})}>
                                <Avatar
                                    overrides={{
                                        Root: {
                                            style: ({$theme}) => ({
                                                ...expandBorderStyles($theme.borders.border600),
                                            }),
                                        },
                                    }}
                                    name={context.walletAddress ? context.walletAddress : ""}
                                    size="scale1600"
                                    src={`https://identicon-api.herokuapp.com/${context.walletAddress}/256?format=png`}
                                />
                                <div style={{marginLeft: 8, marginRight: 8}}/>
                                <ParagraphSmall> {context.walletAddress} </ParagraphSmall>
                            </div>
                            <div style={{marginTop: 16, marginBottom: 16}}/>
                            <Button size="compact" isLoading={connecting} onClick={nextStep}>
                                Next Step
                            </Button>
                        </>
                    ) : (
                        <>
                            <ParagraphMedium>
                                Before actually using the application, you need to connect your wallet first. This application is deployed to the <strong>BSC Testnet</strong>.
                            </ParagraphMedium>
                            <Button size="compact" onClick={connectWallet}>
                                Connect with Metamask
                            </Button>
                        </>
                    )}
                </Step>
                <Step title="Input Deployed SubscriptionHub Contract Address">
                    <ParagraphMedium>
                        Here please input the deployed SubscriptionHub contract address. For demonstration, we have a pre-deployed SubscriptionHub contract on BSC Testnet for you: <strong>0x1343c4067081FFeCe94519aFDe9EA82fb260B381</strong>. This hub is configured to have 25% fee percentage, 5 minutes interval (So every subscriber will be charged every 5 minutes, traditionally this is usually set to 1 month). Note that in production we will have multiple contracts with different intervals deployed for more use cases (i.e. 1 month, 3 month, 6 month, 1 year, etc.)
                    </ParagraphMedium>
                    <Input
                        value={contractAddress}
                        onChange={e => setContractAddress(e.currentTarget.value)}
                        size={SIZE.compact}
                        placeholder="0xf39fd6e..."
                        clearOnEscape
                        disabled={!!context.contract}
                    />
                    <div style={{marginTop: 8, marginBottom: 8}}/>
                    {context.contract ? (
                        <Button size="compact" isLoading={confirming} onClick={configCompleted}>
                            Next Step
                        </Button>
                    ) : (
                        <Button size="compact" isLoading={confirming} onClick={contractAddressConfirm}>
                            Confirm
                        </Button>
                    )}
                </Step>
            </ProgressSteps>
            {context.configured && (
                <>
                    <div style={{marginTop: 16, marginBottom: 16}}/>
                    <ParagraphMedium>
                        You have successfully configured the application. You can now use the application. Please go back to the top of the page to check <strong>Service</strong> section and <strong>User</strong> section.
                    </ParagraphMedium>
                </>
            )}
        </HeadingLevel>
    )
}

export default Configuration;