#ifndef _WASM_UTIL_H
#define _WASM_UTIL_H

#include<stdint.h>

static uint8_t* _write_leb_u32(uint8_t* ptr, uint32_t v)
{
    uint8_t byte;
    do {
        byte = v & 0b1111111; // get last 7 bits
        v >>= 7; // shift them away from the value
        if (v != 0)
        {
            byte |= 0b10000000; // turn on MSB
        }
        *ptr++ = byte;
    } while (v != 0);
    return ptr;
}

static uint8_t* _write_leb_i32(uint8_t* ptr, int32_t v)
{
    // Super complex stuff. See the following:
    // https://en.wikipedia.org/wiki/LEB128#Encode_signed_integer
    // http://llvm.org/doxygen/LEB128_8h_source.html#l00048

    bool more = true;
    bool negative = v < 0;
    uint32_t size = 32;
    uint8_t byte;
    while (more)
    {
        byte = v & 0b1111111; // get last 7 bits
        v >>= 7; // shift them away from the value
        if (negative)
        {
            v |= (~0 << (size - 7)); // extend sign
        }
        uint8_t sign_bit = byte & (1 << 6);
        if ((v == 0 && sign_bit == 0) || (v == -1 && sign_bit != 0))
        {
            more = false;
        }
        else
        {
            byte |= 0b10000000; // turn on MSB
        }
        *ptr++ = byte;
    }
    return ptr;
}

static void inline write_fixed_leb16_to_ptr(uint8_t* ptr, uint16_t x)
{
    if (x < 128)
    {
        *ptr = x | 0b10000000;
        *(ptr + 1) = 0;
    }
    else
    {
        *ptr = (x & 0b1111111) | 0b10000000;
        *(ptr + 1) = x >> 7;
    }
}

static void cs_write_u8(uint8_t);
static void cs_write_u32(uint32_t);
static void cs_write_i32(int32_t);

static void inline push_i32(int32_t v)
{
    cs_write_u8(OP_I32CONST);
    cs_write_i32(v);
}

static void inline push_u32(uint32_t v)
{
    cs_write_u8(OP_I32CONST);
    cs_write_u32(v);
}

static void inline load_u16(uint32_t addr)
{
    cs_write_u8(OP_I32CONST);
    cs_write_u32(addr);
    cs_write_u8(OP_I32LOAD16U);
    cs_write_u8(MEM_IMM_ALIGNMENT);
    cs_write_u8(MEM_IMM_OFFSET);
}

static void inline load_i32(uint32_t addr)
{
    cs_write_u8(OP_I32CONST);
    cs_write_u32(addr);
    cs_write_u8(OP_I32LOAD);
    cs_write_u8(MEM_IMM_ALIGNMENT);
    cs_write_u8(MEM_IMM_OFFSET);
}

static void inline store_i32()
{
    cs_write_u8(OP_I32STORE);
    cs_write_u8(MEM_IMM_ALIGNMENT);
    cs_write_u8(MEM_IMM_OFFSET);
}

static void inline add_i32()
{
    cs_write_u8(OP_I32ADD);
}

static void inline and_i32()
{
    cs_write_u8(OP_I32AND);
}

static void inline shl_i32()
{
    cs_write_u8(OP_I32SHL);
}

static void inline call_fn(uint8_t fn_idx)
{
    cs_write_u8(OP_CALL);
    cs_write_u8(fn_idx);
}

static void inline call_fn_with_arg(uint8_t fn_idx, int32_t arg0)
{
    push_i32(arg0);
    call_fn(fn_idx);
}

#endif
