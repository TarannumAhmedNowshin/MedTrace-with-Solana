//! Offline type-check stub for Anchor's proc macros (NOT a real implementation).
use proc_macro::{Delimiter, TokenStream, TokenTree};

fn name_after(ts: &TokenStream, kw: &str) -> String {
    let v: Vec<TokenTree> = ts.clone().into_iter().collect();
    for i in 0..v.len() { if let TokenTree::Ident(id) = &v[i] { if id.to_string() == kw { if let Some(TokenTree::Ident(n)) = v.get(i+1) { return n.to_string(); } } } }
    panic!("no {kw}")
}
fn body(ts: &TokenStream) -> TokenStream {
    ts.clone().into_iter().filter_map(|t| match t { TokenTree::Group(g) if g.delimiter() == Delimiter::Brace => Some(g.stream()), _ => None }).last().unwrap()
}
fn strip_attr(ts: TokenStream, attr: &str) -> TokenStream {
    let v: Vec<TokenTree> = ts.into_iter().collect();
    let mut out = Vec::new(); let mut i = 0;
    while i < v.len() {
        if let (TokenTree::Punct(p), Some(TokenTree::Group(g))) = (&v[i], v.get(i+1)) {
            if p.as_char() == '#' && g.delimiter() == Delimiter::Bracket && g.stream().to_string().starts_with(attr) { i += 2; continue; }
        }
        match &v[i] {
            TokenTree::Group(g) => { let mut ng = proc_macro::Group::new(g.delimiter(), strip_attr(g.stream(), attr)); ng.set_span(g.span()); out.push(TokenTree::Group(ng)); }
            t => out.push(t.clone()),
        }
        i += 1;
    }
    out.into_iter().collect()
}
#[proc_macro_attribute] pub fn program(_: TokenStream, i: TokenStream) -> TokenStream { i }
#[proc_macro_attribute] pub fn account(_: TokenStream, i: TokenStream) -> TokenStream {
    let n = name_after(&i, "struct");
    let mut s = i.to_string(); s.push_str(&format!(" impl anchor_lang::Owned for {n} {{}}")); s.parse().unwrap()
}
#[proc_macro_attribute] pub fn event(_: TokenStream, i: TokenStream) -> TokenStream { i }
#[proc_macro_attribute] pub fn error_code(_: TokenStream, i: TokenStream) -> TokenStream {
    let n = name_after(&i, "enum");
    let mut s = strip_attr(i, "msg").to_string();
    s.push_str(&format!(" impl From<{n}> for anchor_lang::error::Error {{ fn from(_: {n}) -> Self {{ anchor_lang::error::Error }} }}"));
    s.parse().unwrap()
}
#[proc_macro_derive(Accounts, attributes(account, instruction))]
pub fn accounts(i: TokenStream) -> TokenStream {
    let n = name_after(&i, "struct");
    // field names = ident immediately before a top-level ':' (single colon)
    let v: Vec<TokenTree> = body(&i).into_iter().collect();
    let mut fields = Vec::new();
    for w in 0..v.len().saturating_sub(1) {
        if let (TokenTree::Ident(id), TokenTree::Punct(p)) = (&v[w], &v[w+1]) {
            let next_colon = matches!(v.get(w+2), Some(TokenTree::Punct(q)) if q.as_char()==':');
            if p.as_char() == ':' && !next_colon && id.to_string() != "pub" { fields.push(id.to_string()); }
        }
    }
    let f: String = fields.iter().map(|f| format!("pub {f}: u8,")).collect();
    format!("#[derive(Default)] pub struct {n}Bumps {{ {f} }} impl<'info> anchor_lang::Bumps for {n}<'info> {{ type Bumps = {n}Bumps; }}").parse().unwrap()
}
#[proc_macro_derive(InitSpace, attributes(max_len))]
pub fn init_space(i: TokenStream) -> TokenStream {
    let n = name_after(&i, if i.to_string().contains("struct") { "struct" } else { "enum" });
    format!("impl {n} {{ pub const INIT_SPACE: usize = 0; }}").parse().unwrap()
}
#[proc_macro_derive(AnchorSerialize)] pub fn ser(_: TokenStream) -> TokenStream { TokenStream::new() }
#[proc_macro_derive(AnchorDeserialize)] pub fn de(_: TokenStream) -> TokenStream { TokenStream::new() }
