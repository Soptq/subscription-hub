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

import { ethers, providers, Contract } from "ethers"
import SubscriptionHubABI from "../artifacts/contracts/SubscriptionHub.sol/SubscriptionHub.json";

function Configuration(props) {
    const [configurationStep, setConfigurationStep] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [contractAddress, setContractAddress] = useState("");
    const [confirming, setconfirming] = useState(false);

    const { context, setContext } = useContext(Context);
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
        const updatedContext = context;
        updatedContext.connected = true;
        updatedContext.walletAddress = address;
        updatedContext.provider = _provider;
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
        const contract = new Contract(formattedAddress, SubscriptionHubABI.abi, context.provider.getSigner());
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
                                Before actually using the application, you need to connect your wallet first.
                            </ParagraphMedium>
                            <Button size="compact" onClick={connectWallet}>
                                Connect with Metamask
                            </Button>
                        </>
                    )}
                </Step>
                <Step title="Input Deployed SubscriptionHub Contract Address">
                    <ParagraphMedium>
                        Here please input the deployed SubscriptionHub contract address.
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
        </HeadingLevel>
    )
}

export default Configuration;