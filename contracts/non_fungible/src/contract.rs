// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.4.1


use soroban_sdk::{Address, contract, contractimpl, Env, String, Symbol};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_contract_utils::pausable::{self as pausable, Pausable};
use stellar_contract_utils::upgradeable::UpgradeableInternal;
use stellar_macros::{default_impl, only_role, Upgradeable, when_not_paused};
use stellar_tokens::non_fungible::{
    Base, burnable::NonFungibleBurnable, enumerable::{NonFungibleEnumerable, Enumerable},
    NonFungibleToken
};

#[derive(Upgradeable)]
#[contract]
pub struct GrapeFermenter;

#[contractimpl]
impl GrapeFermenter {
    pub fn __constructor(e: &Env, admin: Address, pauser: Address, upgrader: Address, minter: Address) {
        let uri = String::from_str(e, "www.mytoken.com");
        let name = String::from_str(e, "GrapeFermenter");
        let symbol = String::from_str(e, "GF");
        Base::set_metadata(e, uri, name, symbol);
        access_control::set_admin(e, &admin);
        access_control::grant_role_no_auth(e, &admin, &pauser, &Symbol::new(e, "pauser"));
        access_control::grant_role_no_auth(e, &admin, &upgrader, &Symbol::new(e, "upgrader"));
        access_control::grant_role_no_auth(e, &admin, &minter, &Symbol::new(e, "minter"));
    }

    #[only_role(caller, "minter")]
    #[when_not_paused]
    pub fn mint(e: &Env, to: Address, token_id: u32, caller: Address) {
        Enumerable::non_sequential_mint(e, &to, token_id);
    }
}

#[default_impl]
#[contractimpl]
impl NonFungibleToken for GrapeFermenter {
    type ContractType = Enumerable;

    #[when_not_paused]
    fn transfer(e: &Env, from: Address, to: Address, token_id: u32) {
        Self::ContractType::transfer(e, &from, &to, token_id);
    }

    #[when_not_paused]
    fn transfer_from(e: &Env, spender: Address, from: Address, to: Address, token_id: u32) {
        Self::ContractType::transfer_from(e, &spender, &from, &to, token_id);
    }
}

//
// Extensions
//

#[contractimpl]
impl NonFungibleBurnable for GrapeFermenter {
    #[when_not_paused]
    fn burn(e: &Env, from: Address, token_id: u32) {
        Self::ContractType::burn(e, &from, token_id);
    }

    #[when_not_paused]
    fn burn_from(e: &Env, spender: Address, from: Address, token_id: u32) {
        Self::ContractType::burn_from(e, &spender, &from, token_id);
    }
}

#[default_impl]
#[contractimpl]
impl NonFungibleEnumerable for GrapeFermenter {}

//
// Utils
//

impl UpgradeableInternal for GrapeFermenter {
    fn _require_auth(e: &Env, operator: &Address) {
        access_control::ensure_role(e, operator, &Symbol::new(e, "upgrader"));
        operator.require_auth();
    }
}

#[contractimpl]
impl Pausable for GrapeFermenter {
    fn paused(e: &Env) -> bool {
        pausable::paused(e)
    }

    #[only_role(caller, "pauser")]
    fn pause(e: &Env, caller: Address) {
        pausable::pause(e);
    }

    #[only_role(caller, "pauser")]
    fn unpause(e: &Env, caller: Address) {
        pausable::unpause(e);
    }
}

#[default_impl]
#[contractimpl]
impl AccessControl for GrapeFermenter {}
