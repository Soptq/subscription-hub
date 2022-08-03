import { Heading, HeadingLevel } from 'baseui/heading'
import {ParagraphSmall} from 'baseui/typography';
import {Input, SIZE} from "baseui/input";
import {useContext, useState, useEffect, useCallback} from "react";
import {Button} from "baseui/button";

import {ethers} from "ethers";
import {useSnackbar} from "baseui/snackbar";
import {Context} from "../../Context";

import { debounce } from "lodash";
import {Tag, VARIANT} from 'baseui/tag';

const { default: Resolution } = require('@unstoppabledomains/resolution');
const variants = Object.keys(VARIANT);

function ServiceRegister() {
    const [receiver, setReceiver] = useState("");
    const [tokenAddress, setTokenAddress] = useState("");
    const [tokenAmount, setTokenAmount] = useState("");
    const [registering, setRegistering] = useState(false);

    const [registeredServiceHash, setRegisteredServiceHash] = useState("");

    const { context} = useContext(Context);

    const { enqueue } = useSnackbar();

    const udResolution = new Resolution();
    const supportedUDDomains = [".zil", ".crypto", ".nft", ".blockchain", ".bitcoin", "coin", "wallet", ".888", ".dao", ".x"]

    const debouncedDomainLookup = useCallback(debounce((value, setFn) => {
        if (supportedUDDomains.some(postfix => value.endsWith(postfix))) {
            // try resolve ud domain
            udResolution.addr(value, "ETH")
                .then((address) => setFn(address))
                .catch(e => {
                    console.warn("Failed to resolve a possible UD domain", e)
                });
        }
    }, 1000), [])

    useEffect(() => {
        return () => {
            debouncedDomainLookup.cancel();
        }
    }, []);

    const getDecimal = async (tokenAddress) => {
        const contract = new ethers.Contract(
            tokenAddress,
            [
                "function decimals() view returns (uint256)"
            ],
            context.provider
        );
        try {
            return await contract.decimals();
        } catch (e) {
            return 18;
        }
    }

    const registerService = async () => {
        setRegistering(true);
        try {
            const formattedReceiver = ethers.utils.getAddress(receiver);
            const formattedTokenAddress = ethers.utils.getAddress(tokenAddress);
            const formattedTokenAmount = ethers.utils.parseUnits(tokenAmount, await getDecimal(formattedTokenAddress));

            const estimatedGasLimit = await context.contract.estimateGas.registerService(
                formattedReceiver,
                formattedTokenAddress,
                formattedTokenAmount
            );
            const estimatedGasPrice = await context.provider.getGasPrice();

            const registerTx = await context.contract.registerService(
                formattedReceiver,
                formattedTokenAddress,
                formattedTokenAmount,
                {
                    gasLimit: estimatedGasLimit.mul(2),
                    gasPrice: estimatedGasPrice,
                }
            );
            const registerReceipt = await registerTx.wait();
            for (const event of registerReceipt.events) {
                if (event.event === "ServiceRegistered") {
                    setRegisteredServiceHash(event.args.serviceHash)
                }
            }
            setRegistering(false);
        } catch (e) {
            console.log(e);
            enqueue({
                message: "Failed to register the service: " + e.toString(),
                kind: "error",
            });
            setRegistering(false);
        }
    }

    return (
        <HeadingLevel>
            <Heading>Register Your Service</Heading>
            <ParagraphSmall>Here by providing the following parameters, you can register your own service to the contract. Regarding to the token address field, you can, for example, input 0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee if your service want to take BUSD (BSC Testnet). You can fund your subscriber with some test BUSD or other tokens at https://testnet.binance.org/faucet-smart.</ParagraphSmall>
            <Input
                value={receiver}
                onChange={e => {
                    debouncedDomainLookup(e.currentTarget.value, setReceiver);
                    setReceiver(e.currentTarget.value);
                }}
                size={SIZE.compact}
                placeholder="address to receive the payment from subscribers"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Input
                value={tokenAddress}
                onChange={e => setTokenAddress(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="token address that subscribers will pay"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Input
                value={tokenAmount}
                onChange={e => setTokenAmount(e.currentTarget.value)}
                size={SIZE.compact}
                placeholder="Token amount that subscribers will pay for each subscription"
                clearOnEscape
            />
            <div style={{marginTop: 8, marginBottom: 8}}/>
            <Button size="compact" isLoading={registering} onClick={registerService}>
                Register Service
            </Button>
            <div style={{marginTop: 8, marginBottom: 8}}/>
            {registeredServiceHash && (
                <ParagraphSmall>
                    <Tag closeable={false} variant={variants[1]} kind="positive">
                        Service Hash (ID)
                    </Tag><strong>{registeredServiceHash}</strong>
                </ParagraphSmall>
            )}
        </HeadingLevel>
    )
}

export default ServiceRegister;