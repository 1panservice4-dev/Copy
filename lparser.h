#ifndef lparser_h
#define lparser_h

/* Dyndata가 incomplete type으로 터지는 것을 막기 위해 실제 루아 코어의 정의를 직접 주입합니다 */
typedef struct Labellist {
  struct Labeldesc *arr;
  int n;
  int size;
} Labellist;

typedef struct Dyndata {
  struct {
    struct Vardesc *arr;
    int n;
    int size;
  } actvar;
  Labellist gt;
  Labellist label;
} Dyndata;

#include "llimits.h"
#include "lobject.h"
#include "lzio.h"

/*
** Expression and variable descriptor
*/

typedef enum {
  VVOID,        /* no value */
  VNIL,
  VTRUE,
  VFALSE,
  VK,           /* info = index of constant in 'k' */
  VKFLT,        /* nval = numerical float value */
  VKINT,        /* nval = numerical integer value */
  VNONRELOC,    /* info = result register */
  VLOCAL,       /* info = local register */
  VUPVAL,       /* info = index of upvalue in 'upvalues' */
  VINDEXED,     /* ind.idx = table register or upvalue index;
                   ind.t = key register or 'k' index */
  VJMP,         /* info = instruction pc */
  VRELOCABLE,   /* info = instruction pc */
  VCALL,        /* info = instruction pc */
  VVARARG       /* info = instruction pc */
} expkind;


typedef struct expdesc {
  expkind k;
  union {
    struct {  /* for indexed variables */
      short idx;  /* index (register or upvalue) */
      short t;  /* table (register or upvalue) */
    } ind;
    int info;  /* for generic use */
    lua_Number nval;
    lua_Integer ival;
  } u;
  int t;  /* patch list of 'exit when true' */
  int f;  /* patch list of 'exit when false' */
} expdesc;


/* description of active local variable */
typedef struct Vardesc {
  short idx;  /* variable index in stack */
} Vardesc;


/* description of the dynamic state of a function into the parser */
typedef struct FuncState {
  Proto *f;  /* current function header */
  struct FuncState *prev;  /* enclosing function */
  struct LexState *ls;  /* lexical state */
  struct BlockCnt *bl;  /* chain of current blocks */
  int pc;  /* next position to code (equivalent to 'ncode') */
  int lasttarget;   /* 'pc' of last 'jump target' */
  int jpc;  /* list of pending jumps to 'pc' */
  int nk;  /* number of elements in 'k' */
  int np;  /* number of elements in 'p' */
  int firstlocal;  /* index of first local var (in 'actvar') */
  short nactvar;  /* number of active local variables */
  lu_byte nups;  /* number of upvalues */
  lu_byte freereg;  /* first free register */
} FuncState;


LUAI_FUNC LClosure *luaY_parser (lua_State *L, ZIO *z, Mbuffer *buff,
                                 Dyndata *dyd, const char *name, int firstchar);


#endif
